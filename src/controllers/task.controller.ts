import { Response } from 'express';
import { catchAsync, BadRequestError } from '../utils/errors';
import * as taskService from '../services/task.service';
import { AuthRequest } from '../middlewares/auth';
import { TaskStatus, TaskPriority } from '@prisma/client';

export const createTask = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const task = await taskService.createTask(userId, req.body);

  res.status(201).json({
    status: 'success',
    data: { task },
  });
});

export const getTasks = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  
  const status = req.query.status as TaskStatus | undefined;
  const priority = req.query.priority as TaskPriority | undefined;
  const search = req.query.search as string | undefined;

  const tasks = await taskService.getTasks(userId, { status, priority, search });

  res.status(200).json({
    status: 'success',
    results: tasks.length,
    data: { tasks },
  });
});

export const getTaskById = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const userRole = req.user!.role;
  const taskId = req.params.id;

  const task = await taskService.getTaskById(taskId, userId, userRole);

  res.status(200).json({
    status: 'success',
    data: { task },
  });
});

export const updateTask = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const userRole = req.user!.role;
  const taskId = req.params.id;

  const task = await taskService.updateTask(taskId, userId, userRole, req.body);

  res.status(200).json({
    status: 'success',
    data: { task },
  });
});

export const deleteTask = catchAsync(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const userRole = req.user!.role;
  const taskId = req.params.id;

  const result = await taskService.deleteTask(taskId, userId, userRole);

  res.status(200).json({
    status: 'success',
    message: result.message,
  });
});
