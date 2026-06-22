"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
exports.registerSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string({
            required_error: 'Email is required',
        }).email('Invalid email address'),
        password: zod_1.z.string({
            required_error: 'Password is required',
        }).min(6, 'Password must be at least 6 characters long'),
        name: zod_1.z.string().optional(),
    }),
});
exports.loginSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string({
            required_error: 'Email is required',
        }).email('Invalid email address'),
        password: zod_1.z.string({
            required_error: 'Password is required',
        }),
    }),
});
