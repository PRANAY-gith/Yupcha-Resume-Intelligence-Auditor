"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_1 = __importDefault(require("./auth.routes"));
const task_routes_1 = __importDefault(require("./task.routes"));
const router = (0, express_1.Router)();
router.use('/auth', auth_routes_1.default);
router.use('/tasks', task_routes_1.default);
// Health check endpoint
router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Server is healthy and running',
        timestamp: new Date().toISOString(),
    });
});
exports.default = router;
