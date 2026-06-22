"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTask = exports.updateTask = exports.getTaskById = exports.getTasks = exports.createTask = void 0;
const errors_1 = require("../utils/errors");
const taskService = __importStar(require("../services/task.service"));
exports.createTask = (0, errors_1.catchAsync)(async (req, res) => {
    const userId = req.user.id;
    const task = await taskService.createTask(userId, req.body);
    res.status(201).json({
        status: 'success',
        data: { task },
    });
});
exports.getTasks = (0, errors_1.catchAsync)(async (req, res) => {
    const userId = req.user.id;
    const status = req.query.status;
    const priority = req.query.priority;
    const search = req.query.search;
    const tasks = await taskService.getTasks(userId, { status, priority, search });
    res.status(200).json({
        status: 'success',
        results: tasks.length,
        data: { tasks },
    });
});
exports.getTaskById = (0, errors_1.catchAsync)(async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const taskId = req.params.id;
    const task = await taskService.getTaskById(taskId, userId, userRole);
    res.status(200).json({
        status: 'success',
        data: { task },
    });
});
exports.updateTask = (0, errors_1.catchAsync)(async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const taskId = req.params.id;
    const task = await taskService.updateTask(taskId, userId, userRole, req.body);
    res.status(200).json({
        status: 'success',
        data: { task },
    });
});
exports.deleteTask = (0, errors_1.catchAsync)(async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const taskId = req.params.id;
    const result = await taskService.deleteTask(taskId, userId, userRole);
    res.status(200).json({
        status: 'success',
        message: result.message,
    });
});
