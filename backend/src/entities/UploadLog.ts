import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class UploadLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  videoId!: string;

  @Column({ nullable: true })
  youtubeVideoId!: string;

  @Column({ nullable: true })
  scheduledId!: string;

  @Column({ type: 'text', nullable: true })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ type: 'simple-json', nullable: true })
  tags!: string[];

  @Column({ type: 'simple-json', nullable: true })
  hashtags!: string[];

  @Column({ type: 'datetime' })
  uploadTime!: Date;

  @Column({ default: true })
  success!: boolean;

  @Column({ nullable: true })
  errorMessage!: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata!: {
    views?: number;
    likes?: number;
    comments?: number;
  };
}
