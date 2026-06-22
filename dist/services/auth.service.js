"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = __importDefault(require("../config/db"));
const errors_1 = require("../utils/errors");
const client_1 = require("@prisma/client");
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-development-only-123456!';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const generateToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};
const register = async (data) => {
    const existingUser = await db_1.default.user.findUnique({
        where: { email: data.email },
    });
    if (existingUser) {
        throw new errors_1.ConflictError('Email is already in use');
    }
    const hashedPassword = await bcryptjs_1.default.hash(data.password, 12);
    const newUser = await db_1.default.user.create({
        data: {
            email: data.email,
            password: hashedPassword,
            name: data.name,
            role: client_1.UserRole.USER, // Default to USER, first user manually changed to admin if needed
        },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
        },
    });
    const token = generateToken({
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
    });
    return { user: newUser, token };
};
exports.register = register;
const login = async (data) => {
    const user = await db_1.default.user.findUnique({
        where: { email: data.email },
    });
    if (!user || !(await bcryptjs_1.default.compare(data.password, user.password))) {
        throw new errors_1.UnauthorizedError('Incorrect email or password');
    }
    const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role,
    });
    return {
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            createdAt: user.createdAt,
        },
        token,
    };
};
exports.login = login;
