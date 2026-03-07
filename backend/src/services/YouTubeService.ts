import { google, youtube_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs-extra';
import path from 'path';
import { AppDataSource } from '../database';
import { Video, VideoStatus } from '../entities/Video';
import { Settings } from '../entities/Settings';
import { UploadLog } from '../entities/UploadLog';
import { WebSocketService } from './WebSocketService';
import { AIService } from './AIService';

export class YouTubeService {
  private static oauth2Client: OAuth2Client | null = null;
  private static youtube: youtube_v3.Youtube | null = null;

  static initialize() {
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const redirectUri = process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/api/youtube/callback';

    if (clientId && clientSecret) {
      this.oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
      
      // Load saved tokens if available
      this.loadSavedTokens();
    }
  }

  private static async loadSavedTokens() {
    try {
      const settings = await AppDataSource.getRepository(Settings).findOne({ where: {} });
      if (settings?.youtubeCredentials) {
        const tokens = JSON.parse(settings.youtubeCredentials);
        this.oauth2Client?.setCredentials(tokens);
        this.youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });
      }
    } catch (error) {
      console.error('Failed to load YouTube tokens:', error);
    }
  }

  static getAuthUrl(): string {
    if (!this.oauth2Client) {
      throw new Error('YouTube OAuth not configured');
    }

    const scopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    });
  }

  static async handleCallback(code: string): Promise<void> {
    if (!this.oauth2Client) {
      throw new Error('YouTube OAuth not configured');
    }

    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    this.youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });

    // Save tokens
    const settingsRepo = AppDataSource.getRepository(Settings);
    let settings = await settingsRepo.findOne({ where: {} });
    
    if (!settings) {
      settings = settingsRepo.create({});
    }
    
    settings.youtubeCredentials = JSON.stringify(tokens);
    await settingsRepo.save(settings);
  }

  static async uploadVideo(
    videoId: string,
    options: {
      title?: string;
      description?: string;
      tags?: string[];
      categoryId?: string;
      privacyStatus?: 'public' | 'unlisted' | 'private';
      autoGenerateContent?: boolean;
      notifySubscribers?: boolean;
    } = {}
  ): Promise<any> {
    if (!this.youtube) {
      throw new Error('YouTube not authenticated');
    }

    const videoRepo = AppDataSource.getRepository(Video);
    const video = await videoRepo.findOneBy({ id: videoId });

    if (!video || !video.processedPath) {
      throw new Error('Video not found or not processed');
    }

    video.status = VideoStatus.UPLOADING;
    await videoRepo.save(video);

    WebSocketService.broadcast('upload:start', { videoId });

    try {
      let title = options.title;
      let description = options.description;
      let tags = options.tags || [];

      // Auto-generate content if requested
      if (options.autoGenerateContent || (!title && !description)) {
        const aiContent = await AIService.generateVideoContent(
          video.title || 'Video',
          video.description || '',
          'general',
          'bn'
        );

        title = title || aiContent.title;
        description = description || aiContent.description;
        tags = tags.length > 0 ? tags : [...aiContent.tags, ...aiContent.hashtags];

        // Save AI generated content
        video.aiGenerated = {
          title: aiContent.title,
          description: aiContent.description,
          tags: aiContent.tags,
          hashtags: aiContent.hashtags,
        };
      }

      // Get default settings
      const settings = await AppDataSource.getRepository(Settings).findOne({ where: {} });
      const uploadDefaults = settings?.uploadDefaults || {};

      const finalTitle = title || video.title || 'Untitled Video';
      const finalDescription = description || '';
      const finalTags = tags.length > 0 ? tags : uploadDefaults.tags || [];
      const finalCategoryId = options.categoryId || uploadDefaults.categoryId || '22'; // People & Blogs
      const finalPrivacyStatus = options.privacyStatus || uploadDefaults.privacyStatus || 'public';

      // Upload video
      const fileSize = (await fs.stat(video.processedPath)).size;
      
      const response = await this.youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: finalTitle.substring(0, 100),
            description: finalDescription.substring(0, 5000),
            tags: finalTags,
            categoryId: finalCategoryId,
          },
          status: {
            privacyStatus: finalPrivacyStatus,
            selfDeclaredMadeForKids: false,
          },
        },
        media: {
          body: fs.createReadStream(video.processedPath),
        },
        notifySubscribers: options.notifySubscribers ?? uploadDefaults.notifySubscribers ?? true,
      });

      const youtubeVideoId = response.data.id;

      // Update video record
      video.status = VideoStatus.UPLOADED;
      video.uploadInfo = {
        youtubeVideoId,
        uploadDate: new Date(),
      };
      await videoRepo.save(video);

      // Log upload
      const uploadLog = AppDataSource.getRepository(UploadLog).create({
        videoId,
        youtubeVideoId,
        title: finalTitle,
        description: finalDescription,
        tags: finalTags,
        uploadTime: new Date(),
        success: true,
      });
      await AppDataSource.getRepository(UploadLog).save(uploadLog);

      // Auto-delete if enabled
      if (settings?.autoDeleteAfterUpload) {
        await this.cleanupVideoFiles(video);
      }

      WebSocketService.broadcast('upload:complete', { videoId, youtubeVideoId });

      return {
        youtubeVideoId,
        url: `https://youtube.com/shorts/${youtubeVideoId}`,
        title: finalTitle,
      };
    } catch (error) {
      video.status = VideoStatus.FAILED;
      video.processingLogs = [...(video.processingLogs || []), `Upload error: ${error}`];
      await videoRepo.save(video);

      // Log failed upload
      const uploadLog = AppDataSource.getRepository(UploadLog).create({
        videoId,
        uploadTime: new Date(),
        success: false,
        errorMessage: (error as Error).message,
      });
      await AppDataSource.getRepository(UploadLog).save(uploadLog);

      WebSocketService.broadcast('upload:error', { videoId, error: (error as Error).message });
      throw error;
    }
  }

  static async uploadShort(
    videoId: string,
    options: {
      title?: string;
      description?: string;
      tags?: string[];
      autoGenerateContent?: boolean;
    } = {}
  ): Promise<any> {
    // YouTube Shorts are just regular videos with #Shorts hashtag
    const settings = await AppDataSource.getRepository(Settings).findOne({ where: {} });
    
    return this.uploadVideo(videoId, {
      ...options,
      tags: [...(options.tags || []), 'Shorts', 'YouTube Shorts'],
      categoryId: '22', // People & Blogs - best for Shorts
      privacyStatus: 'public',
    });
  }

  static async getUploadStatus(videoId: string): Promise<any> {
    const video = await AppDataSource.getRepository(Video).findOneBy({ id: videoId });
    if (!video) {
      throw new Error('Video not found');
    }

    return {
      status: video.status,
      youtubeVideoId: video.uploadInfo?.youtubeVideoId,
      uploadDate: video.uploadInfo?.uploadDate,
    };
  }

  static async getChannelStats(): Promise<any> {
    if (!this.youtube) {
      throw new Error('YouTube not authenticated');
    }

    try {
      const channels = await this.youtube.channels.list({
        part: ['statistics', 'snippet'],
        mine: true,
      });

      const channel = channels.data.items?.[0];
      if (!channel) {
        throw new Error('Channel not found');
      }

      return {
        title: channel.snippet?.title,
        subscribers: channel.statistics?.subscriberCount,
        views: channel.statistics?.viewCount,
        videos: channel.statistics?.videoCount,
      };
    } catch (error) {
      throw new Error(`Failed to get channel stats: ${error}`);
    }
  }

  static async revokeAuth(): Promise<void> {
    if (this.oauth2Client) {
      await this.oauth2Client.revokeCredentials();
    }
    
    const settingsRepo = AppDataSource.getRepository(Settings);
    const settings = await settingsRepo.findOne({ where: {} });
    if (settings) {
      settings.youtubeCredentials = '';
      await settingsRepo.save(settings);
    }
    
    this.youtube = null;
  }

  static isAuthenticated(): boolean {
    return this.youtube !== null;
  }

  private static async cleanupVideoFiles(video: Video): Promise<void> {
    try {
      if (video.localPath) await fs.remove(video.localPath).catch(() => {});
      if (video.processedPath) await fs.remove(video.processedPath).catch(() => {});
      if (video.thumbnailPath) await fs.remove(video.thumbnailPath).catch(() => {});
    } catch (error) {
      console.error('Failed to cleanup video files:', error);
    }
  }
}
