import { DataSource } from 'typeorm';
import { Video } from './entities/Video';
import { Audio } from './entities/Audio';
import { Schedule } from './entities/Schedule';
import { Settings } from './entities/Settings';
import { UploadLog } from './entities/UploadLog';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: process.env.DATABASE_PATH || 'database.sqlite',
  synchronize: true,
  logging: false,
  entities: [Video, Audio, Schedule, Settings, UploadLog],
  migrations: [],
  subscribers: [],
});
