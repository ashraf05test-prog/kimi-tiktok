import { Router } from 'express';
import { VideoService } from '../services/VideoService';
import { VideoStatus } from '../entities/Video';

const router = Router();

// Download video from URL
router.post('/download', async (req, res, next) => {
  try {
    const { url, mute = true, quality = 'medium' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const video = await VideoService.downloadVideo(url, { mute, quality });
    res.json({ success: true, video });
  } catch (error) {
    next(error);
  }
});

// Download multiple videos
router.post('/download/bulk', async (req, res, next) => {
  try {
    const { urls, mute = true, quality = 'medium' } = req.body;
    
    if (!urls || !Array.isArray(urls)) {
      return res.status(400).json({ error: 'URLs array is required' });
    }

    const results = await Promise.allSettled(
      urls.map(url => VideoService.downloadVideo(url, { mute, quality }))
    );

    const videos = results.map((result, index) => ({
      url: urls[index],
      success: result.status === 'fulfilled',
      video: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null,
    }));

    res.json({ success: true, videos });
  } catch (error) {
    next(error);
  }
});

// Get video info without downloading
router.post('/info', async (req, res, next) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const info = await VideoService.getVideoInfo(url);
    res.json({ success: true, info });
  } catch (error) {
    next(error);
  }
});

// Get all videos
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    const videos = await VideoService.getAllVideos(status as VideoStatus);
    res.json({ success: true, videos });
  } catch (error) {
    next(error);
  }
});

// Get video by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const video = await VideoService.getVideoById(id);
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json({ success: true, video });
  } catch (error) {
    next(error);
  }
});

// Mute video
router.post('/:id/mute', async (req, res, next) => {
  try {
    const { id } = req.params;
    const video = await VideoService.muteVideo(id);
    res.json({ success: true, video });
  } catch (error) {
    next(error);
  }
});

// Merge video with audio
router.post('/:id/merge', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { audioId, loop = false, fade = false } = req.body;
    
    if (!audioId) {
      return res.status(400).json({ error: 'Audio ID is required' });
    }

    const video = await VideoService.mergeWithAudio(id, audioId, { loop, fade });
    res.json({ success: true, video });
  } catch (error) {
    next(error);
  }
});

// Auto-merge with random audio
router.post('/:id/auto-merge', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { category } = req.body;
    
    const { AudioService } = require('../services/AudioService');
    const audio = await AudioService.getRandomAudio(category);
    
    if (!audio) {
      return res.status(404).json({ error: 'No audio available' });
    }

    const video = await VideoService.mergeWithAudio(id, audio.id, { loop: true });
    res.json({ success: true, video, audio });
  } catch (error) {
    next(error);
  }
});

// Update video
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const video = await VideoService.updateVideo(id, updates);
    res.json({ success: true, video });
  } catch (error) {
    next(error);
  }
});

// Delete video
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await VideoService.deleteVideo(id);
    res.json({ success: true, message: 'Video deleted' });
  } catch (error) {
    next(error);
  }
});

// Create zip from videos
router.post('/zip', async (req, res, next) => {
  try {
    const { videoIds } = req.body;
    
    if (!videoIds || !Array.isArray(videoIds)) {
      return res.status(400).json({ error: 'Video IDs array is required' });
    }

    const zipPath = await VideoService.createZipFromVideos(videoIds);
    const filename = zipPath.split('/').pop();
    
    res.json({ 
      success: true, 
      zipPath: `/temp/${filename}`,
      downloadUrl: `/temp/${filename}`,
    });
  } catch (error) {
    next(error);
  }
});

export { router as videoRouter };
