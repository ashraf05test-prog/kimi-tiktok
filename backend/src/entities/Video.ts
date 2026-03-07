import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

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

@Entity()
export class Video {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  originalUrl!: string;

  @Column({ nullable: true })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ nullable: true })
  localPath!: string;

  @Column({ nullable: true })
  processedPath!: string;

  @Column({ nullable: true })
  thumbnailPath!: string;

  @Column({ type: 'enum', enum: VideoStatus, default: VideoStatus.PENDING })
  status!: VideoStatus;

  @Column({ nullable: true })
  audioId!: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata!: {
    duration?: number;
    width?: number;
    height?: number;
    fps?: number;
    format?: string;
    size?: number;
  };

  @Column({ type: 'simple-json', nullable: true })
  aiGenerated!: {
    title?: string;
    description?: string;
    tags?: string[];
    hashtags?: string[];
  };

  @Column({ type: 'simple-json', nullable: true })
  uploadInfo!: {
    youtubeVideoId?: string;
    uploadDate?: Date;
    scheduledTime?: Date;
  };

  @Column({ default: false })
  isMuted!: boolean;

  @Column({ nullable: true })
  sourcePlatform!: string;

  @Column({ type: 'simple-json', nullable: true })
  processingLogs!: string[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
