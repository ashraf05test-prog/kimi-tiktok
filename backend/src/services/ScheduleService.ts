import { AppDataSource } from '../database';
import { Schedule, ScheduleStatus } from '../entities/Schedule';
import { Video, VideoStatus } from '../entities/Video';
import { Settings } from '../entities/Settings';
import { YouTubeService } from './YouTubeService';
import { AIService } from './AIService';
import { WebSocketService } from './WebSocketService';
import cron from 'node-cron';

export class ScheduleService {
  private static isInitialized = false;
  private static tasks: Map<string, cron.ScheduledTask> = new Map();

  static initialize() {
    if (this.isInitialized) return;

    // Schedule checker - runs every minute
    cron.schedule('* * * * *', async () => {
      await this.checkScheduledUploads();
    });

    // Daily scheduler - runs at midnight to schedule next day's uploads
    cron.schedule('0 0 * * *', async () => {
      await this.scheduleDailyUploads();
    });

    this.isInitialized = true;
    console.log('Schedule service initialized');
  }

  static async createSchedule(
    videoId: string,
    scheduledTime: Date,
    options: {
      autoGenerateContent?: boolean;
      uploadConfig?: any;
      isRecurring?: boolean;
      recurringPattern?: string;
    } = {}
  ): Promise<Schedule> {
    const scheduleRepo = AppDataSource.getRepository(Schedule);
    const videoRepo = AppDataSource.getRepository(Video);

    const video = await videoRepo.findOneBy({ id: videoId });
    if (!video) {
      throw new Error('Video not found');
    }

    // Update video status
    video.status = VideoStatus.SCHEDULED;
    await videoRepo.save(video);

    const schedule = scheduleRepo.create({
      videoId,
      scheduledTime,
      status: ScheduleStatus.ACTIVE,
      autoGenerateContent: options.autoGenerateContent ?? true,
      uploadConfig: options.uploadConfig || {},
      isRecurring: options.isRecurring || false,
      recurringPattern: options.recurringPattern,
    });

    return scheduleRepo.save(schedule);
  }

  static async createBulkSchedule(
    videoIds: string[],
    times: string[], // ['12:00', '20:00']
    options: {
      autoGenerateContent?: boolean;
      uploadConfig?: any;
      startDate?: Date;
    } = {}
  ): Promise<Schedule[]> {
    const schedules: Schedule[] = [];
    const startDate = options.startDate || new Date();
    
    let currentDate = new Date(startDate);
    let timeIndex = 0;

    for (const videoId of videoIds) {
      const timeStr = times[timeIndex % times.length];
      const [hours, minutes] = timeStr.split(':').map(Number);
      
      const scheduledTime = new Date(currentDate);
      scheduledTime.setHours(hours, minutes, 0, 0);

      // If time has passed, move to next day
      if (scheduledTime < new Date()) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }

      const schedule = await this.createSchedule(videoId, scheduledTime, {
        autoGenerateContent: options.autoGenerateContent,
        uploadConfig: options.uploadConfig,
      });

      schedules.push(schedule);

      timeIndex++;
      if (timeIndex >= times.length) {
        timeIndex = 0;
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    return schedules;
  }

  static async checkScheduledUploads(): Promise<void> {
    const scheduleRepo = AppDataSource.getRepository(Schedule);
    
    const now = new Date();
    const dueSchedules = await scheduleRepo.find({
      where: {
        status: ScheduleStatus.ACTIVE,
        scheduledTime: now,
      },
    });

    for (const schedule of dueSchedules) {
      await this.executeSchedule(schedule);
    }
  }

  static async executeSchedule(schedule: Schedule): Promise<void> {
    const scheduleRepo = AppDataSource.getRepository(Schedule);
    
    try {
      schedule.status = ScheduleStatus.UPLOADING;
      await scheduleRepo.save(schedule);

      WebSocketService.broadcast('schedule:execute', { scheduleId: schedule.id, videoId: schedule.videoId });

      // Upload video
      const result = await YouTubeService.uploadVideo(schedule.videoId, {
        ...schedule.uploadConfig,
        autoGenerateContent: schedule.autoGenerateContent,
      });

      schedule.status = ScheduleStatus.COMPLETED;
      schedule.executedAt = new Date();
      await scheduleRepo.save(schedule);

      WebSocketService.broadcast('schedule:complete', { 
        scheduleId: schedule.id, 
        videoId: schedule.videoId,
        youtubeVideoId: result.youtubeVideoId,
      });

      // Handle recurring schedules
      if (schedule.isRecurring && schedule.recurringPattern) {
        await this.createRecurringSchedule(schedule);
      }

    } catch (error) {
      schedule.status = ScheduleStatus.FAILED;
      schedule.errorMessage = (error as Error).message;
      schedule.retryCount += 1;
      await scheduleRepo.save(schedule);

      WebSocketService.broadcast('schedule:error', { 
        scheduleId: schedule.id, 
        videoId: schedule.videoId,
        error: (error as Error).message,
      });

      // Retry logic
      if (schedule.retryCount < 3) {
        setTimeout(() => this.executeSchedule(schedule), 5 * 60 * 1000); // Retry after 5 minutes
      }
    }
  }

  static async createRecurringSchedule(parentSchedule: Schedule): Promise<void> {
    if (!parentSchedule.recurringPattern) return;

    const nextDate = this.calculateNextDate(
      parentSchedule.scheduledTime,
      parentSchedule.recurringPattern
    );

    await this.createSchedule(parentSchedule.videoId, nextDate, {
      autoGenerateContent: parentSchedule.autoGenerateContent,
      uploadConfig: parentSchedule.uploadConfig,
      isRecurring: true,
      recurringPattern: parentSchedule.recurringPattern,
    });
  }

  private static calculateNextDate(currentDate: Date, pattern: string): Date {
    const nextDate = new Date(currentDate);
    
    switch (pattern) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      default:
        // Custom pattern: every N days
        const match = pattern.match(/every_(\d+)_days/);
        if (match) {
          nextDate.setDate(nextDate.getDate() + parseInt(match[1]));
        }
    }

    return nextDate;
  }

  static async scheduleDailyUploads(): Promise<void> {
    const settings = await AppDataSource.getRepository(Settings).findOne({ where: {} });
    if (!settings?.scheduleDefaults) return;

    const { times, maxDailyUploads } = settings.scheduleDefaults;
    if (!times || times.length === 0) return;

    // Get pending videos
    const videoRepo = AppDataSource.getRepository(Video);
    const pendingVideos = await videoRepo.find({
      where: { status: VideoStatus.READY },
      take: maxDailyUploads || times.length,
      order: { createdAt: 'ASC' },
    });

    if (pendingVideos.length === 0) return;

    // Schedule videos
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await this.createBulkSchedule(
      pendingVideos.map(v => v.id),
      times,
      { startDate: tomorrow }
    );
  }

  static async getAllSchedules(status?: ScheduleStatus): Promise<Schedule[]> {
    const scheduleRepo = AppDataSource.getRepository(Schedule);
    
    if (status) {
      return scheduleRepo.find({
        where: { status },
        order: { scheduledTime: 'ASC' },
      });
    }

    return scheduleRepo.find({
      order: { scheduledTime: 'ASC' },
    });
  }

  static async getScheduleById(id: string): Promise<Schedule | null> {
    const scheduleRepo = AppDataSource.getRepository(Schedule);
    return scheduleRepo.findOneBy({ id });
  }

  static async updateSchedule(id: string, updates: Partial<Schedule>): Promise<Schedule> {
    const scheduleRepo = AppDataSource.getRepository(Schedule);
    const schedule = await scheduleRepo.findOneBy({ id });
    
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    Object.assign(schedule, updates);
    return scheduleRepo.save(schedule);
  }

  static async deleteSchedule(id: string): Promise<void> {
    const scheduleRepo = AppDataSource.getRepository(Schedule);
    const schedule = await scheduleRepo.findOneBy({ id });
    
    if (schedule) {
      // Update video status back to READY
      const videoRepo = AppDataSource.getRepository(Video);
      const video = await videoRepo.findOneBy({ id: schedule.videoId });
      if (video) {
        video.status = VideoStatus.READY;
        await videoRepo.save(video);
      }

      await scheduleRepo.remove(schedule);
    }
  }

  static async pauseSchedule(id: string): Promise<Schedule> {
    return this.updateSchedule(id, { status: ScheduleStatus.PAUSED });
  }

  static async resumeSchedule(id: string): Promise<Schedule> {
    return this.updateSchedule(id, { status: ScheduleStatus.ACTIVE });
  }

  static async getUpcomingSchedules(limit: number = 10): Promise<Schedule[]> {
    const scheduleRepo = AppDataSource.getRepository(Schedule);
    
    return scheduleRepo.find({
      where: {
        status: ScheduleStatus.ACTIVE,
        scheduledTime: new Date(),
      },
      order: { scheduledTime: 'ASC' },
      take: limit,
    });
  }

  static async getScheduleStats(): Promise<{
    total: number;
    active: number;
    completed: number;
    failed: number;
    paused: number;
  }> {
    const scheduleRepo = AppDataSource.getRepository(Schedule);
    
    const [total, active, completed, failed, paused] = await Promise.all([
      scheduleRepo.count(),
      scheduleRepo.count({ where: { status: ScheduleStatus.ACTIVE } }),
      scheduleRepo.count({ where: { status: ScheduleStatus.COMPLETED } }),
      scheduleRepo.count({ where: { status: ScheduleStatus.FAILED } }),
      scheduleRepo.count({ where: { status: ScheduleStatus.PAUSED } }),
    ]);

    return { total, active, completed, failed, paused };
  }
}
