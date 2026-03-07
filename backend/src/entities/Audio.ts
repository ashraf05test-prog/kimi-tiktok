import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum AudioSource {
  UPLOADED = 'uploaded',
  YOUTUBE = 'youtube',
  EXTRACTED = 'extracted'
}

@Entity()
export class Audio {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  originalUrl!: string;

  @Column()
  localPath!: string;

  @Column({ type: 'enum', enum: AudioSource, default: AudioSource.UPLOADED })
  source!: AudioSource;

  @Column({ type: 'float', nullable: true })
  duration!: number;

  @Column({ nullable: true })
  format!: string;

  @Column({ type: 'integer', nullable: true })
  size!: number;

  @Column({ default: false })
  isFavorite!: boolean;

  @Column({ type: 'simple-json', nullable: true })
  metadata!: {
    bitrate?: number;
    sampleRate?: number;
    channels?: number;
  };

  @Column({ nullable: true })
  category!: string;

  @Column({ default: 0 })
  useCount!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
