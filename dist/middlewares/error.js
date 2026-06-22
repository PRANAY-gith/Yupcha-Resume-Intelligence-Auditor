"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errors_1 = require("../utils/errors");
const zod_1 = require("zod");
const errorHandler = (err, req, res, next) => {
    // If it's a validation error from Zod
    if (err instanceof zod_1.ZodError) {
        const errors = err.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
        }));
        return res.status(400).json({
            status: 'fail',
            message: 'Validation Error',
            errors,
        });
    }
    // If it is our custom operational AppError
    if (err instanceof errors_1.AppError) {
        return res.status(err.statusCode).json({
            status: err.statusCode >= 500 ? 'error' : 'fail',
            message: err.message,
        });
    }
    // Handle Prisma Database Errors
    if (err.name === 'PrismaClientKnownRequestError') {
        // We can cast to any to read the prisma code
        const prismaErr = err;
        if (prismaErr.code === 'P2002') {
            return res.status(409).json({
                status: 'fail',
                message: `Duplicate field value: ${prismaErr.meta?.target || 'field'}. Please use another value.`,
            });
        }
        if (prismaErr.code === 'P2025') {
            return res.status(404).json({
                status: 'fail',
                message: prismaErr.meta?.cause || 'Record not found.',
            });
        }
    }
    // Fallback for unhandled developer or system errors
    console.error('Unhandled Error 💥:', err);
    return res.status(500).json({
        status: 'error',
        message: process.env.NODE_ENV === 'production'
            ? 'Internal server error occurred'
            : err.message,
    });
};
exports.errorHandler = errorHandler;
