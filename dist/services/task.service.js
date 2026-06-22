"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTask = exports.updateTask = exports.getTaskById = exports.getTasks = exports.createTask = void 0;
const db_1 = __importDefault(require("../config/db"));
const errors_1 = require("../utils/errors");
const createTask = async (userId, data) => {
    return db_1.default.task.create({
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
exports.createTask = createTask;
const getTasks = async (userId, filters) => {
    const whereClause = { userId };
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
    return db_1.default.task.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
    });
};
exports.getTasks = getTasks;
const getTaskById = async (taskId, userId, userRole) => {
    const task = await db_1.default.task.findUnique({
        where: { id: taskId },
    });
    if (!task) {
        throw new errors_1.NotFoundError('Task not found');
    }
    // Authorize: check if owner or if ADMIN
    if (task.userId !== userId && userRole !== 'ADMIN') {
        throw new errors_1.ForbiddenError('You do not have access to this task');
    }
    return task;
};
exports.getTaskById = getTaskById;
const updateTask = async (taskId, userId, userRole, data) => {
    // First verify existence and authorization
    const task = await (0, exports.getTaskById)(taskId, userId, userRole);
    const updateData = { ...data };
    if (data.dueDate !== undefined) {
        updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }
    return db_1.default.task.update({
        where: { id: taskId },
        data: updateData,
    });
};
exports.updateTask = updateTask;
const deleteTask = async (taskId, userId, userRole) => {
    // First verify existence and authorization
    await (0, exports.getTaskById)(taskId, userId, userRole);
    await db_1.default.task.delete({
        where: { id: taskId },
    });
    return { success: true, message: 'Task deleted successfully' };
};
exports.deleteTask = deleteTask;
