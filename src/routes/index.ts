import { Router } from 'express';
import authRoutes from './auth.routes';
import taskRoutes from './task.routes';
import notesRoutes from './notes.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/tasks', taskRoutes);
router.use('/notes', notesRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is healthy and running',
    timestamp: new Date().toISOString(),
  });
});

export default router;
