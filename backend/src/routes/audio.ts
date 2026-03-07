import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { AudioService } from '../services/AudioService';

const router = Router();

// Configure multer for audio uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/audio'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'audio-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/m4a'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  },
});

// Upload audio file
router.post('/upload', upload.single('audio'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const { name } = req.body;
    const audio = await AudioService.uploadAudio(req.file, name);
    
    res.json({ success: true, audio });
  } catch (error) {
    next(error);
  }
});

// Download audio from YouTube
router.post('/download', async (req, res, next) => {
  try {
    const { url, name } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const audio = await AudioService.downloadFromYouTube(url, name);
    res.json({ success: true, audio });
  } catch (error) {
    next(error);
  }
});

// Extract audio from video
router.post('/extract/:videoId', async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const { name } = req.body;
    
    const audio = await AudioService.extractAudioFromVideo(videoId, name);
    res.json({ success: true, audio });
  } catch (error) {
    next(error);
  }
});

// Get all audio files
router.get('/', async (req, res, next) => {
  try {
    const audio = await AudioService.getAllAudio();
    res.json({ success: true, audio });
  } catch (error) {
    next(error);
  }
});

// Get audio by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const audio = await AudioService.getAudioById(id);
    
    if (!audio) {
      return res.status(404).json({ error: 'Audio not found' });
    }

    res.json({ success: true, audio });
  } catch (error) {
    next(error);
  }
});

// Get random audio
router.get('/random/:category?', async (req, res, next) => {
  try {
    const { category } = req.params;
    const audio = await AudioService.getRandomAudio(category);
    
    if (!audio) {
      return res.status(404).json({ error: 'No audio available' });
    }

    res.json({ success: true, audio });
  } catch (error) {
    next(error);
  }
});

// Update audio
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const audio = await AudioService.updateAudio(id, updates);
    res.json({ success: true, audio });
  } catch (error) {
    next(error);
  }
});

// Delete audio
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await AudioService.deleteAudio(id);
    res.json({ success: true, message: 'Audio deleted' });
  } catch (error) {
    next(error);
  }
});

export { router as audioRouter };
