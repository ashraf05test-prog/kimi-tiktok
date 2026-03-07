import { Router } from 'express';
import { AppDataSource } from '../database';
import { Settings } from '../entities/Settings';

const router = Router();

// Get all settings
router.get('/', async (req, res, next) => {
  try {
    const settingsRepo = AppDataSource.getRepository(Settings);
    let settings = await settingsRepo.findOne({ where: {} });

    if (!settings) {
      // Create default settings
      settings = settingsRepo.create({
        uploadDefaults: {
          categoryId: '22',
          privacyStatus: 'public',
          tags: ['Shorts', 'YouTube Shorts', 'Viral'],
          language: 'bn',
          notifySubscribers: true,
        },
        scheduleDefaults: {
          times: ['12:00', '20:00'],
          timezone: 'Asia/Dhaka',
          maxDailyUploads: 2,
        },
        aiConfig: {
          model: 'gemini',
          language: 'bn',
          tone: 'engaging',
          maxTitleLength: 100,
          maxDescriptionLength: 500,
          maxHashtags: 15,
        },
        driveConfig: {
          autoUpload: false,
          autoCleanup: true,
        },
        autoDeleteAfterUpload: true,
        videoQuality: 'medium',
      });
      await settingsRepo.save(settings);
    }

    // Remove sensitive data
    const safeSettings = {
      ...settings,
      youtubeCredentials: settings.youtubeCredentials ? '***configured***' : null,
      googleDriveCredentials: settings.googleDriveCredentials ? '***configured***' : null,
      geminiApiKey: settings.geminiApiKey ? '***configured***' : null,
      grokApiKey: settings.grokApiKey ? '***configured***' : null,
    };

    res.json({ success: true, settings: safeSettings });
  } catch (error) {
    next(error);
  }
});

// Update settings
router.patch('/', async (req, res, next) => {
  try {
    const updates = req.body;
    const settingsRepo = AppDataSource.getRepository(Settings);
    
    let settings = await settingsRepo.findOne({ where: {} });
    if (!settings) {
      settings = settingsRepo.create({});
    }

    // Handle nested updates
    if (updates.uploadDefaults) {
      settings.uploadDefaults = { ...settings.uploadDefaults, ...updates.uploadDefaults };
    }
    if (updates.scheduleDefaults) {
      settings.scheduleDefaults = { ...settings.scheduleDefaults, ...updates.scheduleDefaults };
    }
    if (updates.aiConfig) {
      settings.aiConfig = { ...settings.aiConfig, ...updates.aiConfig };
    }
    if (updates.driveConfig) {
      settings.driveConfig = { ...settings.driveConfig, ...updates.driveConfig };
    }

    // Handle direct field updates
    const directFields = ['autoDeleteAfterUpload', 'videoQuality'];
    directFields.forEach(field => {
      if (updates[field] !== undefined) {
        (settings as any)[field] = updates[field];
      }
    });

    await settingsRepo.save(settings);

    // Return safe settings
    const safeSettings = {
      ...settings,
      youtubeCredentials: settings.youtubeCredentials ? '***configured***' : null,
      googleDriveCredentials: settings.googleDriveCredentials ? '***configured***' : null,
      geminiApiKey: settings.geminiApiKey ? '***configured***' : null,
      grokApiKey: settings.grokApiKey ? '***configured***' : null,
    };

    res.json({ success: true, settings: safeSettings });
  } catch (error) {
    next(error);
  }
});

// Update API keys
router.post('/api-keys', async (req, res, next) => {
  try {
    const { geminiApiKey, grokApiKey } = req.body;
    const settingsRepo = AppDataSource.getRepository(Settings);
    
    let settings = await settingsRepo.findOne({ where: {} });
    if (!settings) {
      settings = settingsRepo.create({});
    }

    if (geminiApiKey) settings.geminiApiKey = geminiApiKey;
    if (grokApiKey) settings.grokApiKey = grokApiKey;

    await settingsRepo.save(settings);

    res.json({ success: true, message: 'API keys updated' });
  } catch (error) {
    next(error);
  }
});

// Reset settings to default
router.post('/reset', async (req, res, next) => {
  try {
    const settingsRepo = AppDataSource.getRepository(Settings);
    const settings = await settingsRepo.findOne({ where: {} });

    if (settings) {
      await settingsRepo.remove(settings);
    }

    res.json({ success: true, message: 'Settings reset. Default settings will be created on next request.' });
  } catch (error) {
    next(error);
  }
});

export { router as settingsRouter };
