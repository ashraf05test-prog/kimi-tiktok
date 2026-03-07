import { AppDataSource } from '../database';
import { Audio, AudioSource } from '../entities/Audio';
import path from 'path';
import fs from 'fs-extra';
import { exec } from 'child_process';
import { promisify } from 'util';
import YTDlpWrap from 'yt-dlp-wrap';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

export class AudioService {
  private static audioRepository = AppDataSource.getRepository(Audio);
  private static ytDlp: YTDlpWrap;

  static initialize() {
    this.ytDlp = new YTDlpWrap();
  }

  static async uploadAudio(file: Express.Multer.File, name?: string): Promise<Audio> {
    const audioDir = path.join(__dirname, '../../uploads/audio');
    await fs.ensureDir(audioDir);

    const id = uuidv4();
    const ext = path.extname(file.originalname);
    const filename = `${id}${ext}`;
    const localPath = path.join(audioDir, filename);

    await fs.move(file.path, localPath);

    // Get audio info using ffprobe
    const info = await this.getAudioInfo(localPath);

    const audio = this.audioRepository.create({
      id,
      name: name || file.originalname.replace(ext, ''),
      localPath,
      source: AudioSource.UPLOADED,
      duration: info.duration,
      format: ext.slice(1),
      size: file.size,
      metadata: {
        bitrate: info.bitrate,
        sampleRate: info.sampleRate,
        channels: info.channels,
      },
    });

    return this.audioRepository.save(audio);
  }

  static async downloadFromYouTube(url: string, name?: string): Promise<Audio> {
    const audioDir = path.join(__dirname, '../../uploads/audio');
    await fs.ensureDir(audioDir);

    const id = uuidv4();
    const outputPath = path.join(audioDir, `${id}.%(ext)s`);

    try {
      // Download audio only
      await this.ytDlp.execPromise([
        url,
        '-x', // Extract audio
        '--audio-format', 'mp3',
        '--audio-quality', '0', // Best quality
        '-o', outputPath,
      ]);

      // Find downloaded file
      const files = await fs.readdir(audioDir);
      const downloadedFile = files.find(f => f.startsWith(id));

      if (!downloadedFile) {
        throw new Error('Downloaded audio not found');
      }

      const localPath = path.join(audioDir, downloadedFile);
      const info = await this.getAudioInfo(localPath);
      const videoInfo = await this.ytDlp.getVideoInfo(url);

      const audio = this.audioRepository.create({
        id,
        name: name || videoInfo.title || `Audio ${id}`,
        originalUrl: url,
        localPath,
        source: AudioSource.YOUTUBE,
        duration: info.duration,
        format: 'mp3',
        size: (await fs.stat(localPath)).size,
        metadata: {
          bitrate: info.bitrate,
          sampleRate: info.sampleRate,
          channels: info.channels,
        },
        category: this.detectCategory(videoInfo.title),
      });

      return this.audioRepository.save(audio);
    } catch (error) {
      throw new Error(`Failed to download audio: ${error}`);
    }
  }

  static async extractAudioFromVideo(videoId: string, name?: string): Promise<Audio> {
    const { VideoService } = require('./VideoService');
    const video = await VideoService.getVideoById(videoId);

    if (!video || !video.localPath) {
      throw new Error('Video not found');
    }

    const audioDir = path.join(__dirname, '../../uploads/audio');
    await fs.ensureDir(audioDir);

    const id = uuidv4();
    const outputPath = path.join(audioDir, `${id}.mp3`);

    try {
      // Extract audio using FFmpeg
      const ffmpegCmd = `ffmpeg -i "${video.localPath}" -vn -acodec libmp3lame -q:a 2 "${outputPath}" -y`;
      await execAsync(ffmpegCmd);

      const info = await this.getAudioInfo(outputPath);

      const audio = this.audioRepository.create({
        id,
        name: name || `Extracted from ${video.title || videoId}`,
        localPath: outputPath,
        source: AudioSource.EXTRACTED,
        duration: info.duration,
        format: 'mp3',
        size: (await fs.stat(outputPath)).size,
        metadata: {
          bitrate: info.bitrate,
          sampleRate: info.sampleRate,
          channels: info.channels,
        },
      });

      return this.audioRepository.save(audio);
    } catch (error) {
      throw new Error(`Failed to extract audio: ${error}`);
    }
  }

  static async getAllAudio(): Promise<Audio[]> {
    return this.audioRepository.find({ order: { createdAt: 'DESC' } });
  }

  static async getAudioById(id: string): Promise<Audio | null> {
    return this.audioRepository.findOneBy({ id });
  }

  static async getRandomAudio(category?: string): Promise<Audio | null> {
    const query = category ? { where: { category } } : {};
    const audios = await this.audioRepository.find(query);
    
    if (audios.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * audios.length);
    return audios[randomIndex];
  }

  static async deleteAudio(id: string): Promise<void> {
    const audio = await this.audioRepository.findOneBy({ id });
    if (audio) {
      if (audio.localPath) {
        await fs.remove(audio.localPath).catch(() => {});
      }
      await this.audioRepository.remove(audio);
    }
  }

  static async updateAudio(id: string, updates: Partial<Audio>): Promise<Audio> {
    const audio = await this.audioRepository.findOneBy({ id });
    if (!audio) {
      throw new Error('Audio not found');
    }
    
    Object.assign(audio, updates);
    return this.audioRepository.save(audio);
  }

  private static async getAudioInfo(filePath: string): Promise<any> {
    try {
      const { stdout } = await execAsync(
        `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`
      );
      const info = JSON.parse(stdout);
      const audioStream = info.streams.find((s: any) => s.codec_type === 'audio');
      
      return {
        duration: parseFloat(info.format.duration) || 0,
        bitrate: parseInt(info.format.bit_rate) || 0,
        sampleRate: audioStream?.sample_rate || 0,
        channels: audioStream?.channels || 0,
      };
    } catch (error) {
      return { duration: 0, bitrate: 0, sampleRate: 0, channels: 0 };
    }
  }

  private static detectCategory(title: string): string {
    const lowerTitle = title.toLowerCase();
    
    if (lowerTitle.includes('waz') || lowerTitle.includes('bangla waz') || 
        lowerTitle.includes('islamic') || lowerTitle.includes('quran') ||
        lowerTitle.includes('hadith') || lowerTitle.includes('allah') ||
        lowerTitle.includes('prophet') || lowerTitle.includes('namaz')) {
      return 'islamic';
    }
    
    if (lowerTitle.includes('music') || lowerTitle.includes('song') || 
        lowerTitle.includes('audio') || lowerTitle.includes('sound')) {
      return 'music';
    }
    
    if (lowerTitle.includes('motivation') || lowerTitle.includes('inspiration')) {
      return 'motivation';
    }
    
    return 'general';
  }
}
