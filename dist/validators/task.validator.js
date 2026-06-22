"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskIdSchema = exports.updateTaskSchema = exports.createTaskSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.createTaskSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string({
            required_error: 'Title is required',
        }).min(1, 'Title cannot be empty'),
        description: zod_1.z.string().optional(),
        status: zod_1.z.nativeEnum(client_1.TaskStatus).optional(),
        priority: zod_1.z.nativeEnum(client_1.TaskPriority).optional(),
        dueDate: zod_1.z.string().datetime({ message: 'Invalid ISO date string' }).optional(),
    }),
});
exports.updateTaskSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string().min(1, 'Title cannot be empty').optional(),
        description: zod_1.z.string().optional(),
        status: zod_1.z.nativeEnum(client_1.TaskStatus).optional(),
        priority: zod_1.z.nativeEnum(client_1.TaskPriority).optional(),
        dueDate: zod_1.z.string().datetime({ message: 'Invalid ISO date string' }).optional(),
    }),
    params: zod_1.z.object({
        id: zod_1.z.string().uuid('Invalid task ID format'),
    }),
});
exports.taskIdSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().uuid('Invalid task ID format'),
    }),
});
