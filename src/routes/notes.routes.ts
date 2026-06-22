import { Router } from 'express';
import { generateNotesHandler } from '../controllers/notes.controller';

const router = Router();

// POST /api/notes/generate
router.post('/generate', generateNotesHandler);

export default router;
