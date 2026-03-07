import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum ScheduleStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  UPLOADING = 'uploading',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

@Entity()
export class Schedule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  videoId!: string;

  @Column({ type: 'datetime' })
  scheduledTime!: Date;

  @Column({ type: 'enum', enum: ScheduleStatus, default: ScheduleStatus.ACTIVE })
  status!: ScheduleStatus;

  @Column({ type: 'simple-json', nullable: true })
  uploadConfig!: {
    title?: string;
    description?: string;
    tags?: string[];
    categoryId?: string;
    privacyStatus?: 'public' | 'unlisted' | 'private';
    notifySubscribers?: boolean;
  };

  @Column({ default: false })
  autoGenerateContent!: boolean;

  @Column({ nullable: true })
  executedAt!: Date;

  @Column({ nullable: true })
  errorMessage!: string;

  @Column({ default: 0 })
  retryCount!: number;

  @Column({ default: false })
  isRecurring!: boolean;

  @Column({ nullable: true })
  recurringPattern!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
