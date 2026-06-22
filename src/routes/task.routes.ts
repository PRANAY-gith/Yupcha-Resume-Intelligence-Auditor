import { Router } from 'express';
import * as taskController from '../controllers/task.controller';
import { validate } from '../middlewares/validate';
import { createTaskSchema, updateTaskSchema, taskIdSchema } from '../validators/task.validator';
import { protect } from '../middlewares/auth';

const router = Router();

// Protect all routes in this file
router.use(protect);

router.post('/', validate(createTaskSchema), taskController.createTask);
router.get('/', taskController.getTasks);
router.get('/:id', validate(taskIdSchema), taskController.getTaskById);
router.patch('/:id', validate(updateTaskSchema), taskController.updateTask);
router.delete('/:id', validate(taskIdSchema), taskController.deleteTask);

export default router;
