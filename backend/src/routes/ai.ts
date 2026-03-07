import { Router } from 'express';
import { AIService } from '../services/AIService';
import { AppDataSource } from '../database';
import { Settings } from '../entities/Settings';

const router = Router();

// Generate video content (title, description, tags, hashtags)
router.post('/generate', async (req, res, next) => {
  try {
    const {
      videoTitle,
      videoDescription,
      category,
      language,
    } = req.body;

    if (!videoTitle) {
      return res.status(400).json({ error: 'Video title is required' });
    }

    const content = await AIService.generateVideoContent(
      videoTitle,
      videoDescription || '',
      category || 'general',
      language || 'bn'
    );

    res.json({ success: true, content });
  } catch (error) {
    next(error);
  }
});

// Analyze video for SEO
router.post('/analyze', async (req, res, next) => {
  try {
    const { videoInfo } = req.body;

    if (!videoInfo) {
      return res.status(400).json({ error: 'Video info is required' });
    }

    const analysis = await AIService.analyzeVideoForSEO(videoInfo);
    res.json({ success: true, analysis });
  } catch (error) {
    next(error);
  }
});

// Get AI configuration
router.get('/config', async (req, res, next) => {
  try {
    const settings = await AppDataSource.getRepository(Settings).findOne({ where: {} });
    const aiConfig = settings?.aiConfig || {
      model: 'gemini',
      language: 'bn',
      tone: 'engaging',
      maxTitleLength: 100,
      maxDescriptionLength: 500,
      maxHashtags: 15,
    };

    res.json({ success: true, config: aiConfig });
  } catch (error) {
    next(error);
  }
});

// Update AI configuration
router.patch('/config', async (req, res, next) => {
  try {
    const updates = req.body;
    const settingsRepo = AppDataSource.getRepository(Settings);
    
    let settings = await settingsRepo.findOne({ where: {} });
    if (!settings) {
      settings = settingsRepo.create({});
    }

    settings.aiConfig = { ...settings.aiConfig, ...updates };
    await settingsRepo.save(settings);

    res.json({ success: true, config: settings.aiConfig });
  } catch (error) {
    next(error);
  }
});

// Test AI connection
router.get('/test', async (req, res, next) => {
  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    const grokKey = process.env.GROK_API_KEY;

    const status = {
      gemini: !!geminiKey,
      grok: !!grokKey,
      message: '',
    };

    if (!geminiKey && !grokKey) {
      status.message = 'No AI API keys configured. Please set GEMINI_API_KEY or GROK_API_KEY.';
    } else {
      status.message = 'AI services configured successfully';
    }

    res.json({ success: true, status });
  } catch (error) {
    next(error);
  }
});

export { router as aiRouter };
