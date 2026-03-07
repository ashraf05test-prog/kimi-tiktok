import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { AppDataSource } from './database';
import { videoRouter } from './routes/video';
import { audioRouter } from './routes/audio';
import { uploadRouter } from './routes/upload';
import { scheduleRouter } from './routes/schedule';
import { aiRouter } from './routes/ai';
import { settingsRouter } from './routes/settings';
import { ScheduleService } from './services/ScheduleService';
import { WebSocketService } from './services/WebSocketService';
import { errorHandler } from './middleware/errorHandler';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use('/temp', express.static(path.join(__dirname, '../temp')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Ensure directories exist
fs.ensureDirSync(path.join(__dirname, '../temp'));
fs.ensureDirSync(path.join(__dirname, '../uploads'));
fs.ensureDirSync(path.join(__dirname, '../uploads/audio'));
fs.ensureDirSync(path.join(__dirname, '../uploads/videos'));

// Routes
app.use('/api/videos', videoRouter);
app.use('/api/audio', audioRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/schedule', scheduleRouter);
app.use('/api/ai', aiRouter);
app.use('/api/settings', settingsRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

// Initialize database and start server
const startServer = async () => {
  try {
    await AppDataSource.initialize();
    console.log('Database connected successfully');

    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Initialize WebSocket
    WebSocketService.initialize(server);

    // Initialize scheduler
    ScheduleService.initialize();

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
