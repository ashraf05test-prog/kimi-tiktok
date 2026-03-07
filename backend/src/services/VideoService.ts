import { AppDataSource } from '../database';
import { Video, VideoStatus } from '../entities/Video';
import { Audio } from '../entities/Audio';
import path from 'path';
import fs from 'fs-extra';
import { exec } from 'child_process';
import { promisify } from 'util';
import { WebSocketService } from './WebSocketService';
import YTDlpWrap from 'yt-dlp-wrap';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

export class VideoService {
  private static videoRepository = AppDataSource.getRepository(Video);
  private static audioRepository = AppDataSource.getRepository(Audio);
  private static ytDlp: YTDlpWrap;

  static initialize() {
    this.ytDlp = new YTDlpWrap();
  }

  static async downloadVideo(url: string, options: { mute?: boolean; quality?: string } = {}): Promise<Video> {
    const video = this.videoRepository.create({
      originalUrl: url,
      status: VideoStatus.DOWNLOADING,
      isMuted: options.mute ?? true,
      sourcePlatform: this.detectPlatform(url),
    });

    await this.videoRepository.save(video);

    try {
      const tempDir = path.join(__dirname, '../../temp');
      const videoId = video.id;
      const outputPath = path.join(tempDir, `${videoId}_original.%(ext)s`);

      // Notify start
      WebSocketService.broadcast('download:start', { videoId, url });

      // Download with yt-dlp
      const downloadOptions: any = {
        output: outputPath,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        addHeader: ['referer:youtube.com', 'user-agent:Mozilla/5.0'],
      };

      // Format selection based on quality
      if (options.quality === 'best') {
        downloadOptions.format = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
      } else if (options.quality === 'worst') {
        downloadOptions.format = 'worst[ext=mp4]/worst';
      } else {
        // Medium quality (default)
        downloadOptions.format = 'best[height<=720][ext=mp4]/best[height<=720]/best[ext=mp4]/best';
      }

      await this.ytDlp.execPromise([url, '-o', outputPath, '-f', downloadOptions.format]);

      // Find downloaded file
      const files = await fs.readdir(tempDir);
      const downloadedFile = files.find(f => f.startsWith(`${videoId}_original`));

      if (!downloadedFile) {
        throw new Error('Downloaded file not found');
      }

      const localPath = path.join(tempDir, downloadedFile);

      // Get video info
      const info = await this.ytDlp.getVideoInfo(url);
      
      // Update video record
      video.localPath = localPath;
      video.title = info.title;
      video.description = info.description;
      video.status = VideoStatus.DOWNLOADED;
      video.metadata = {
        duration: info.duration,
        width: info.width,
        height: info.height,
        fps: info.fps,
        format: path.extname(downloadedFile).slice(1),
        size: (await fs.stat(localPath)).size,
      };

      await this.videoRepository.save(video);

      // If mute is requested, process video
      if (options.mute) {
        await this.muteVideo(video.id);
      }

      WebSocketService.broadcast('download:complete', { videoId, video });

      return video;
    } catch (error) {
      video.status = VideoStatus.FAILED;
      video.processingLogs = [...(video.processingLogs || []), `Download error: ${error}`];
      await this.videoRepository.save(video);
      
      WebSocketService.broadcast('download:error', { videoId: video.id, error: (error as Error).message });
      throw error;
    }
  }

  static async muteVideo(videoId: string): Promise<Video> {
    const video = await this.videoRepository.findOneBy({ id: videoId });
    if (!video || !video.localPath) {
      throw new Error('Video not found or not downloaded');
    }

    video.status = VideoStatus.PROCESSING;
    await this.videoRepository.save(video);

    WebSocketService.broadcast('processing:start', { videoId, type: 'mute' });

    try {
      const tempDir = path.join(__dirname, '../../temp');
      const outputPath = path.join(tempDir, `${videoId}_muted.mp4`);

      // Use FFmpeg to remove audio
      const ffmpegCmd = `ffmpeg -i "${video.localPath}" -c:v copy -an "${outputPath}" -y`;
      await execAsync(ffmpegCmd);

      video.processedPath = outputPath;
      video.isMuted = true;
      video.status = VideoStatus.READY;
      
      await this.videoRepository.save(video);

      WebSocketService.broadcast('processing:complete', { videoId, outputPath });

      return video;
    } catch (error) {
      video.status = VideoStatus.FAILED;
      video.processingLogs = [...(video.processingLogs || []), `Mute error: ${error}`];
      await this.videoRepository.save(video);
      
      WebSocketService.broadcast('processing:error', { videoId, error: (error as Error).message });
      throw error;
    }
  }

  static async mergeWithAudio(videoId: string, audioId: string, options: { loop?: boolean; fade?: boolean } = {}): Promise<Video> {
    const video = await this.videoRepository.findOneBy({ id: videoId });
    const audio = await this.audioRepository.findOneBy({ id: audioId });

    if (!video || !video.processedPath) {
      throw new Error('Video not found or not processed');
    }
    if (!audio || !audio.localPath) {
      throw new Error('Audio not found');
    }

    video.status = VideoStatus.PROCESSING;
    video.audioId = audioId;
    await this.videoRepository.save(video);

    WebSocketService.broadcast('processing:start', { videoId, type: 'merge', audioId });

    try {
      const tempDir = path.join(__dirname, '../../temp');
      const outputPath = path.join(tempDir, `${videoId}_final.mp4`);

      const videoInput = video.processedPath;
      const audioInput = audio.localPath;

      let ffmpegCmd: string;

      if (options.loop) {
        // Loop audio to match video duration
        ffmpegCmd = `ffmpeg -i "${videoInput}" -stream_loop -1 -i "${audioInput}" -c:v copy -c:a aac -shortest "${outputPath}" -y`;
      } else if (options.fade) {
        // Add fade in/out to audio
        const fadeDuration = 3;
        ffmpegCmd = `ffmpeg -i "${videoInput}" -i "${audioInput}" -c:v copy -c:a aac -af "afade=t=in:ss=0:d=${fadeDuration},afade=t=out:st=${video.metadata?.duration || 0}-${fadeDuration}:d=${fadeDuration}" "${outputPath}" -y`;
      } else {
        // Simple merge
        ffmpegCmd = `ffmpeg -i "${videoInput}" -i "${audioInput}" -c:v copy -c:a aac -shortest "${outputPath}" -y`;
      }

      await execAsync(ffmpegCmd);

      // Update audio use count
      audio.useCount += 1;
      await this.audioRepository.save(audio);

      video.processedPath = outputPath;
      video.status = VideoStatus.READY;
      await this.videoRepository.save(video);

      WebSocketService.broadcast('processing:complete', { videoId, outputPath });

      return video;
    } catch (error) {
      video.status = VideoStatus.FAILED;
      video.processingLogs = [...(video.processingLogs || []), `Merge error: ${error}`];
      await this.videoRepository.save(video);
      
      WebSocketService.broadcast('processing:error', { videoId, error: (error as Error).message });
      throw error;
    }
  }

  static async getVideoInfo(url: string): Promise<any> {
    try {
      const info = await this.ytDlp.getVideoInfo(url);
      return {
        title: info.title,
        description: info.description,
        duration: info.duration,
        thumbnail: info.thumbnail,
        uploader: info.uploader,
        viewCount: info.view_count,
        likeCount: info.like_count,
        uploadDate: info.upload_date,
      };
    } catch (error) {
      throw new Error(`Failed to get video info: ${error}`);
    }
  }

  static async getAllVideos(status?: VideoStatus): Promise<Video[]> {
    if (status) {
      return this.videoRepository.find({ where: { status }, order: { createdAt: 'DESC' } });
    }
    return this.videoRepository.find({ order: { createdAt: 'DESC' } });
  }

  static async getVideoById(id: string): Promise<Video | null> {
    return this.videoRepository.findOneBy({ id });
  }

  static async deleteVideo(id: string): Promise<void> {
    const video = await this.videoRepository.findOneBy({ id });
    if (video) {
      // Delete files
      if (video.localPath) await fs.remove(video.localPath).catch(() => {});
      if (video.processedPath) await fs.remove(video.processedPath).catch(() => {});
      if (video.thumbnailPath) await fs.remove(video.thumbnailPath).catch(() => {});
      
      await this.videoRepository.remove(video);
    }
  }

  static async updateVideo(id: string, updates: Partial<Video>): Promise<Video> {
    const video = await this.videoRepository.findOneBy({ id });
    if (!video) {
      throw new Error('Video not found');
    }
    
    Object.assign(video, updates);
    return this.videoRepository.save(video);
  }

  private static detectPlatform(url: string): string {
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('facebook.com')) return 'facebook';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
    return 'unknown';
  }

  static async createZipFromVideos(videoIds: string[]): Promise<string> {
    const archiver = require('archiver');
    const tempDir = path.join(__dirname, '../../temp');
    const zipPath = path.join(tempDir, `videos_${uuidv4()}.zip`);

    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise(async (resolve, reject) => {
      output.on('close', () => resolve(zipPath));
      archive.on('error', reject);

      archive.pipe(output);

      for (const videoId of videoIds) {
        const video = await this.videoRepository.findOneBy({ id: videoId });
        if (video?.processedPath && fs.existsSync(video.processedPath)) {
          archive.file(video.processedPath, { name: `${video.title || videoId}.mp4` });
        }
      }

      await archive.finalize();
    });
  }
}
