import { google, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs-extra';
import path from 'path';
import archiver from 'archiver';
import { AppDataSource } from '../database';
import { Settings } from '../entities/Settings';
import { Video } from '../entities/Video';
import { v4 as uuidv4 } from 'uuid';
import { WebSocketService } from './WebSocketService';

export class GoogleDriveService {
  private static oauth2Client: OAuth2Client | null = null;
  private static drive: drive_v3.Drive | null = null;

  static initialize() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/drive/callback';

    if (clientId && clientSecret) {
      this.oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
      this.loadSavedTokens();
    }
  }

  private static async loadSavedTokens() {
    try {
      const settings = await AppDataSource.getRepository(Settings).findOne({ where: {} });
      if (settings?.googleDriveCredentials) {
        const tokens = JSON.parse(settings.googleDriveCredentials);
        this.oauth2Client?.setCredentials(tokens);
        this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
      }
    } catch (error) {
      console.error('Failed to load Google Drive tokens:', error);
    }
  }

  static getAuthUrl(): string {
    if (!this.oauth2Client) {
      throw new Error('Google Drive OAuth not configured');
    }

    const scopes = [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    });
  }

  static async handleCallback(code: string): Promise<void> {
    if (!this.oauth2Client) {
      throw new Error('Google Drive OAuth not configured');
    }

    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });

    // Save tokens
    const settingsRepo = AppDataSource.getRepository(Settings);
    let settings = await settingsRepo.findOne({ where: {} });
    
    if (!settings) {
      settings = settingsRepo.create({});
    }
    
    settings.googleDriveCredentials = JSON.stringify(tokens);
    await settingsRepo.save(settings);
  }

  static async uploadVideo(videoId: string, folderId?: string): Promise<string> {
    if (!this.drive) {
      throw new Error('Google Drive not authenticated');
    }

    const videoRepo = AppDataSource.getRepository(Video);
    const video = await videoRepo.findOneBy({ id: videoId });

    if (!video || !video.processedPath) {
      throw new Error('Video not found or not processed');
    }

    WebSocketService.broadcast('drive:upload:start', { videoId });

    try {
      const settings = await AppDataSource.getRepository(Settings).findOne({ where: {} });
      const targetFolderId = folderId || settings?.driveConfig?.folderId;

      const fileMetadata: drive_v3.Schema$File = {
        name: `${video.title || videoId}.mp4`,
        mimeType: 'video/mp4',
      };

      if (targetFolderId) {
        fileMetadata.parents = [targetFolderId];
      }

      const media = {
        mimeType: 'video/mp4',
        body: fs.createReadStream(video.processedPath),
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, webViewLink',
      });

      const fileId = response.data.id;
      const webLink = response.data.webViewLink;

      // Make file publicly viewable
      await this.drive.permissions.create({
        fileId: fileId!,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });

      WebSocketService.broadcast('drive:upload:complete', { videoId, fileId });

      return webLink || `https://drive.google.com/file/d/${fileId}/view`;
    } catch (error) {
      WebSocketService.broadcast('drive:upload:error', { videoId, error: (error as Error).message });
      throw error;
    }
  }

  static async uploadZip(
    videoIds: string[],
    zipName?: string,
    folderId?: string
  ): Promise<{ fileId: string; webLink: string }> {
    if (!this.drive) {
      throw new Error('Google Drive not authenticated');
    }

    const videoRepo = AppDataSource.getRepository(Video);
    const tempDir = path.join(__dirname, '../../temp');
    
    // Create zip file
    const zipFileName = `${zipName || `videos_${uuidv4()}`}.zip`;
    const zipPath = path.join(tempDir, zipFileName);

    WebSocketService.broadcast('drive:zip:start', { videoCount: videoIds.length });

    try {
      // Create zip archive
      await this.createZip(videoPath => {
        return videoRepo.findOne({ where: { id: videoPath } });
      }, videoIds, zipPath);

      const settings = await AppDataSource.getRepository(Settings).findOne({ where: {} });
      const targetFolderId = folderId || settings?.driveConfig?.folderId;

      const fileMetadata: drive_v3.Schema$File = {
        name: zipFileName,
        mimeType: 'application/zip',
      };

      if (targetFolderId) {
        fileMetadata.parents = [targetFolderId];
      }

      const media = {
        mimeType: 'application/zip',
        body: fs.createReadStream(zipPath),
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, webViewLink',
      });

      const fileId = response.data.id;
      const webLink = response.data.webViewLink;

      // Make file publicly viewable
      await this.drive.permissions.create({
        fileId: fileId!,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });

      // Cleanup zip file
      await fs.remove(zipPath).catch(() => {});

      WebSocketService.broadcast('drive:zip:complete', { fileId, videoCount: videoIds.length });

      return {
        fileId: fileId!,
        webLink: webLink || `https://drive.google.com/file/d/${fileId}/view`,
      };
    } catch (error) {
      // Cleanup on error
      await fs.remove(zipPath).catch(() => {});
      WebSocketService.broadcast('drive:zip:error', { error: (error as Error).message });
      throw error;
    }
  }

  private static async createZip(
    getVideo: (id: string) => Promise<Video | null>,
    videoIds: string[],
    zipPath: string
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', reject);
      archive.on('warning', (err) => {
        if (err.code !== 'ENOENT') reject(err);
      });

      archive.pipe(output);

      for (const videoId of videoIds) {
        const video = await getVideo(videoId);
        if (video?.processedPath && fs.existsSync(video.processedPath)) {
          const fileName = `${video.title || videoId}.mp4`;
          archive.file(video.processedPath, { name: fileName });
        }
      }

      await archive.finalize();
    });
  }

  static async createFolder(folderName: string, parentFolderId?: string): Promise<string> {
    if (!this.drive) {
      throw new Error('Google Drive not authenticated');
    }

    const fileMetadata: drive_v3.Schema$File = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };

    if (parentFolderId) {
      fileMetadata.parents = [parentFolderId];
    }

    const response = await this.drive.files.create({
      requestBody: fileMetadata,
      fields: 'id',
    });

    return response.data.id!;
  }

  static async listFiles(folderId?: string, pageSize: number = 100): Promise<any[]> {
    if (!this.drive) {
      throw new Error('Google Drive not authenticated');
    }

    const params: drive_v3.Params$Resource$Files$List = {
      pageSize,
      fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink)',
    };

    if (folderId) {
      params.q = `'${folderId}' in parents`;
    }

    const response = await this.drive.files.list(params);
    return response.data.files || [];
  }

  static async deleteFile(fileId: string): Promise<void> {
    if (!this.drive) {
      throw new Error('Google Drive not authenticated');
    }

    await this.drive.files.delete({ fileId });
  }

  static async getStorageInfo(): Promise<{
    limit: string;
    usage: string;
    usageInDrive: string;
    usageInDriveTrash: string;
  }> {
    if (!this.drive) {
      throw new Error('Google Drive not authenticated');
    }

    const response = await this.drive.about.get({
      fields: 'storageQuota',
    });

    const quota = response.data.storageQuota;
    return {
      limit: quota?.limit || '0',
      usage: quota?.usage || '0',
      usageInDrive: quota?.usageInDrive || '0',
      usageInDriveTrash: quota?.usageInDriveTrash || '0',
    };
  }

  static async revokeAuth(): Promise<void> {
    if (this.oauth2Client) {
      await this.oauth2Client.revokeCredentials();
    }
    
    const settingsRepo = AppDataSource.getRepository(Settings);
    const settings = await settingsRepo.findOne({ where: {} });
    if (settings) {
      settings.googleDriveCredentials = '';
      await settingsRepo.save(settings);
    }
    
    this.drive = null;
  }

  static isAuthenticated(): boolean {
    return this.drive !== null;
  }
}
