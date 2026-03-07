import { Router } from 'express';
import { YouTubeService } from '../services/YouTubeService';
import { GoogleDriveService } from '../services/GoogleDriveService';
import { VideoService } from '../services/VideoService';

const router = Router();

// ========== YouTube Routes ==========

// Get YouTube auth URL
router.get('/youtube/auth', async (req, res, next) => {
  try {
    const authUrl = YouTubeService.getAuthUrl();
    res.json({ success: true, authUrl });
  } catch (error) {
    next(error);
  }
});

// Handle YouTube OAuth callback
router.get('/youtube/callback', async (req, res, next) => {
  try {
    const { code } = req.query;
    
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    await YouTubeService.handleCallback(code);
    res.json({ success: true, message: 'YouTube authentication successful' });
  } catch (error) {
    next(error);
  }
});

// Check YouTube auth status
router.get('/youtube/status', async (req, res, next) => {
  try {
    const isAuthenticated = YouTubeService.isAuthenticated();
    res.json({ success: true, isAuthenticated });
  } catch (error) {
    next(error);
  }
});

// Upload video to YouTube
router.post('/youtube/:videoId', async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const {
      title,
      description,
      tags,
      categoryId,
      privacyStatus,
      autoGenerateContent,
      notifySubscribers,
    } = req.body;

    const result = await YouTubeService.uploadVideo(videoId, {
      title,
      description,
      tags,
      categoryId,
      privacyStatus,
      autoGenerateContent,
      notifySubscribers,
    });

    res.json({ success: true, result });
  } catch (error) {
    next(error);
  }
});

// Upload as YouTube Short
router.post('/youtube/:videoId/short', async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const { title, description, tags, autoGenerateContent } = req.body;

    const result = await YouTubeService.uploadShort(videoId, {
      title,
      description,
      tags,
      autoGenerateContent,
    });

    res.json({ success: true, result });
  } catch (error) {
    next(error);
  }
});

// Upload multiple videos to YouTube
router.post('/youtube/bulk/:type?', async (req, res, next) => {
  try {
    const { videoIds, options = {} } = req.body;
    const { type } = req.params;

    if (!videoIds || !Array.isArray(videoIds)) {
      return res.status(400).json({ error: 'Video IDs array is required' });
    }

    const results = await Promise.allSettled(
      videoIds.map(videoId => {
        if (type === 'short') {
          return YouTubeService.uploadShort(videoId, options);
        }
        return YouTubeService.uploadVideo(videoId, options);
      })
    );

    const uploads = results.map((result, index) => ({
      videoId: videoIds[index],
      success: result.status === 'fulfilled',
      result: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null,
    }));

    res.json({ success: true, uploads });
  } catch (error) {
    next(error);
  }
});

// Get upload status
router.get('/youtube/status/:videoId', async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const status = await YouTubeService.getUploadStatus(videoId);
    res.json({ success: true, status });
  } catch (error) {
    next(error);
  }
});

// Get channel stats
router.get('/youtube/channel/stats', async (req, res, next) => {
  try {
    const stats = await YouTubeService.getChannelStats();
    res.json({ success: true, stats });
  } catch (error) {
    next(error);
  }
});

// Revoke YouTube auth
router.post('/youtube/revoke', async (req, res, next) => {
  try {
    await YouTubeService.revokeAuth();
    res.json({ success: true, message: 'YouTube authentication revoked' });
  } catch (error) {
    next(error);
  }
});

// ========== Google Drive Routes ==========

// Get Google Drive auth URL
router.get('/drive/auth', async (req, res, next) => {
  try {
    const authUrl = GoogleDriveService.getAuthUrl();
    res.json({ success: true, authUrl });
  } catch (error) {
    next(error);
  }
});

// Handle Google Drive OAuth callback
router.get('/drive/callback', async (req, res, next) => {
  try {
    const { code } = req.query;
    
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    await GoogleDriveService.handleCallback(code);
    res.json({ success: true, message: 'Google Drive authentication successful' });
  } catch (error) {
    next(error);
  }
});

// Check Google Drive auth status
router.get('/drive/status', async (req, res, next) => {
  try {
    const isAuthenticated = GoogleDriveService.isAuthenticated();
    res.json({ success: true, isAuthenticated });
  } catch (error) {
    next(error);
  }
});

// Upload video to Google Drive
router.post('/drive/:videoId', async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const { folderId } = req.body;

    const webLink = await GoogleDriveService.uploadVideo(videoId, folderId);
    res.json({ success: true, webLink });
  } catch (error) {
    next(error);
  }
});

// Upload multiple videos as zip to Google Drive
router.post('/drive/zip', async (req, res, next) => {
  try {
    const { videoIds, zipName, folderId } = req.body;

    if (!videoIds || !Array.isArray(videoIds)) {
      return res.status(400).json({ error: 'Video IDs array is required' });
    }

    const result = await GoogleDriveService.uploadZip(videoIds, zipName, folderId);
    res.json({ success: true, result });
  } catch (error) {
    next(error);
  }
});

// Create folder in Google Drive
router.post('/drive/folder', async (req, res, next) => {
  try {
    const { folderName, parentFolderId } = req.body;

    if (!folderName) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const folderId = await GoogleDriveService.createFolder(folderName, parentFolderId);
    res.json({ success: true, folderId });
  } catch (error) {
    next(error);
  }
});

// List files in Google Drive
router.get('/drive/files', async (req, res, next) => {
  try {
    const { folderId, pageSize } = req.query;
    const files = await GoogleDriveService.listFiles(
      folderId as string,
      pageSize ? parseInt(pageSize as string) : 100
    );
    res.json({ success: true, files });
  } catch (error) {
    next(error);
  }
});

// Get Google Drive storage info
router.get('/drive/storage', async (req, res, next) => {
  try {
    const info = await GoogleDriveService.getStorageInfo();
    res.json({ success: true, info });
  } catch (error) {
    next(error);
  }
});

// Delete file from Google Drive
router.delete('/drive/:fileId', async (req, res, next) => {
  try {
    const { fileId } = req.params;
    await GoogleDriveService.deleteFile(fileId);
    res.json({ success: true, message: 'File deleted' });
  } catch (error) {
    next(error);
  }
});

// Revoke Google Drive auth
router.post('/drive/revoke', async (req, res, next) => {
  try {
    await GoogleDriveService.revokeAuth();
    res.json({ success: true, message: 'Google Drive authentication revoked' });
  } catch (error) {
    next(error);
  }
});

export { router as uploadRouter };
