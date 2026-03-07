import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class Settings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', nullable: true })
  youtubeCredentials!: string;

  @Column({ type: 'text', nullable: true })
  googleDriveCredentials!: string;

  @Column({ nullable: true })
  geminiApiKey!: string;

  @Column({ nullable: true })
  grokApiKey!: string;

  @Column({ type: 'simple-json', nullable: true })
  uploadDefaults!: {
    categoryId?: string;
    privacyStatus?: 'public' | 'unlisted' | 'private';
    tags?: string[];
    language?: string;
    notifySubscribers?: boolean;
  };

  @Column({ type: 'simple-json', nullable: true })
  scheduleDefaults!: {
    times?: string[];
    timezone?: string;
    maxDailyUploads?: number;
  };

  @Column({ type: 'simple-json', nullable: true })
  aiConfig!: {
    model?: 'gemini' | 'grok';
    language?: string;
    tone?: string;
    maxTitleLength?: number;
    maxDescriptionLength?: number;
    maxHashtags?: number;
  };

  @Column({ type: 'simple-json', nullable: true })
  driveConfig!: {
    folderId?: string;
    autoUpload?: boolean;
    autoCleanup?: boolean;
  };

  @Column({ default: true })
  autoDeleteAfterUpload!: boolean;

  @Column({ default: 'medium' })
  videoQuality!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
