import { Router } from 'express';
import { ScheduleService } from '../services/ScheduleService';
import { ScheduleStatus } from '../entities/Schedule';

const router = Router();

// Create schedule
router.post('/', async (req, res, next) => {
  try {
    const { videoId, scheduledTime, ...options } = req.body;

    if (!videoId || !scheduledTime) {
      return res.status(400).json({ error: 'Video ID and scheduled time are required' });
    }

    const schedule = await ScheduleService.createSchedule(
      videoId,
      new Date(scheduledTime),
      options
    );

    res.json({ success: true, schedule });
  } catch (error) {
    next(error);
  }
});

// Create bulk schedule
router.post('/bulk', async (req, res, next) => {
  try {
    const { videoIds, times, ...options } = req.body;

    if (!videoIds || !Array.isArray(videoIds) || !times || !Array.isArray(times)) {
      return res.status(400).json({ error: 'Video IDs and times arrays are required' });
    }

    const schedules = await ScheduleService.createBulkSchedule(videoIds, times, options);
    res.json({ success: true, schedules });
  } catch (error) {
    next(error);
  }
});

// Get all schedules
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    const schedules = await ScheduleService.getAllSchedules(status as ScheduleStatus);
    res.json({ success: true, schedules });
  } catch (error) {
    next(error);
  }
});

// Get schedule by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const schedule = await ScheduleService.getScheduleById(id);

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.json({ success: true, schedule });
  } catch (error) {
    next(error);
  }
});

// Update schedule
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const schedule = await ScheduleService.updateSchedule(id, updates);
    res.json({ success: true, schedule });
  } catch (error) {
    next(error);
  }
});

// Delete schedule
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await ScheduleService.deleteSchedule(id);
    res.json({ success: true, message: 'Schedule deleted' });
  } catch (error) {
    next(error);
  }
});

// Pause schedule
router.post('/:id/pause', async (req, res, next) => {
  try {
    const { id } = req.params;
    const schedule = await ScheduleService.pauseSchedule(id);
    res.json({ success: true, schedule });
  } catch (error) {
    next(error);
  }
});

// Resume schedule
router.post('/:id/resume', async (req, res, next) => {
  try {
    const { id } = req.params;
    const schedule = await ScheduleService.resumeSchedule(id);
    res.json({ success: true, schedule });
  } catch (error) {
    next(error);
  }
});

// Get upcoming schedules
router.get('/upcoming/list', async (req, res, next) => {
  try {
    const { limit } = req.query;
    const schedules = await ScheduleService.getUpcomingSchedules(
      limit ? parseInt(limit as string) : 10
    );
    res.json({ success: true, schedules });
  } catch (error) {
    next(error);
  }
});

// Get schedule stats
router.get('/stats/overview', async (req, res, next) => {
  try {
    const stats = await ScheduleService.getScheduleStats();
    res.json({ success: true, stats });
  } catch (error) {
    next(error);
  }
});

export { router as scheduleRouter };
