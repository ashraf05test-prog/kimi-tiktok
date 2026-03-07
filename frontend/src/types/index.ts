export interface Video {
  id: string;
  originalUrl: string;
  title: string;
  description: string;
  localPath: string;
  processedPath: string;
  thumbnailPath: string;
  status: VideoStatus;
  audioId: string;
  metadata: {
    duration?: number;
    width?: number;
    height?: number;
    fps?: number;
    format?: string;
    size?: number;
  };
  aiGenerated: {
    title?: string;
    description?: string;
    tags?: string[];
    hashtags?: string[];
  };
  uploadInfo: {
    youtubeVideoId?: string;
    uploadDate?: string;
    scheduledTime?: string;
  };
  isMuted: boolean;
  sourcePlatform: string;
  processingLogs: string[];
  createdAt: string;
  updatedAt: string;
}

export enum VideoStatus {
  PENDING = 'pending',
  DOWNLOADING = 'downloading',
  DOWNLOADED = 'downloaded',
  PROCESSING = 'processing',
  READY = 'ready',
  UPLOADING = 'uploading',
  UPLOADED = 'uploaded',
  FAILED = 'failed',
  SCHEDULED = 'scheduled'
}

export interface Audio {
  id: string;
  name: string;
  originalUrl: string;
  localPath: string;
  source: AudioSource;
  duration: number;
  format: string;
  size: number;
  isFavorite: boolean;
  metadata: {
    bitrate?: number;
    sampleRate?: number;
    channels?: number;
  };
  category: string;
  useCount: number;
  createdAt: string;
  updatedAt: string;
}

export enum AudioSource {
  UPLOADED = 'uploaded',
  YOUTUBE = 'youtube',
  EXTRACTED = 'extracted'
}

export interface Schedule {
  id: string;
  videoId: string;
  scheduledTime: string;
  status: ScheduleStatus;
  uploadConfig: {
    title?: string;
    description?: string;
    tags?: string[];
    categoryId?: string;
    privacyStatus?: 'public' | 'unlisted' | 'private';
    notifySubscribers?: boolean;
  };
  autoGenerateContent: boolean;
  executedAt: string;
  errorMessage: string;
  retryCount: number;
  isRecurring: boolean;
  recurringPattern: string;
  createdAt: string;
  updatedAt: string;
}

export enum ScheduleStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface Settings {
  id: string;
  youtubeCredentials: string;
  googleDriveCredentials: string;
  geminiApiKey: string;
  grokApiKey: string;
  uploadDefaults: {
    categoryId?: string;
    privacyStatus?: 'public' | 'unlisted' | 'private';
    tags?: string[];
    language?: string;
    notifySubscribers?: boolean;
  };
  scheduleDefaults: {
    times?: string[];
    timezone?: string;
    maxDailyUploads?: number;
  };
  aiConfig: {
    model?: 'gemini' | 'grok';
    language?: string;
    tone?: string;
    maxTitleLength?: number;
    maxDescriptionLength?: number;
    maxHashtags?: number;
  };
  driveConfig: {
    folderId?: string;
    autoUpload?: boolean;
    autoCleanup?: boolean;
  };
  autoDeleteAfterUpload: boolean;
  videoQuality: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIContent {
  title: string;
  description: string;
  tags: string[];
  hashtags: string[];
}

export interface UploadResult {
  youtubeVideoId: string;
  url: string;
  title: string;
}

export interface DriveUploadResult {
  fileId: string;
  webLink: string;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  timestamp: number;
}
