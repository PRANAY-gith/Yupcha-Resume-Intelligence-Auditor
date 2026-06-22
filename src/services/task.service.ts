import prisma from '../config/db';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { TaskStatus, TaskPriority } from '@prisma/client';

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  search?: string;
}

export const createTask = async (userId: string, data: {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
}) => {
  return prisma.task.create({
    data: {
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      userId,
    },
  });
};

export const getTasks = async (userId: string, filters: TaskFilters) => {
  const whereClause: any = { userId };

  if (filters.status) {
    whereClause.status = filters.status;
  }
  if (filters.priority) {
    whereClause.priority = filters.priority;
  }
  if (filters.search) {
    whereClause.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  return prisma.task.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
  });
};

export const getTaskById = async (taskId: string, userId: string, userRole: string) => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    throw new NotFoundError('Task not found');
  }

  // Authorize: check if owner or if ADMIN
  if (task.userId !== userId && userRole !== 'ADMIN') {
    throw new ForbiddenError('You do not have access to this task');
  }

  return task;
};

export const updateTask = async (
  taskId: string,
  userId: string,
  userRole: string,
  data: {
    title?: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    dueDate?: string;
  }
) => {
  // First verify existence and authorization
  const task = await getTaskById(taskId, userId, userRole);

  const updateData: any = { ...data };
  if (data.dueDate !== undefined) {
    updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  }

  return prisma.task.update({
    where: { id: taskId },
    data: updateData,
  });
};

export const deleteTask = async (taskId: string, userId: string, userRole: string) => {
  // First verify existence and authorization
  await getTaskById(taskId, userId, userRole);

  await prisma.task.delete({
    where: { id: taskId },
  });

  return { success: true, message: 'Task deleted successfully' };
};
