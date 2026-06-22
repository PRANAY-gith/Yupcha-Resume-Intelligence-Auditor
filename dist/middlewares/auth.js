"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.restrictTo = exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const errors_1 = require("../utils/errors");
const db_1 = __importDefault(require("../config/db"));
exports.protect = (0, errors_1.catchAsync)(async (req, res, next) => {
    let token;
    // 1) Getting token and check if it's there
    if (req.headers.authorization?.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
        return next(new errors_1.UnauthorizedError('You are not logged in. Please log in to get access.'));
    }
    // 2) Verification of token
    const secret = process.env.JWT_SECRET || 'super-secret-jwt-key-for-development-only-123456!';
    let decoded;
    try {
        decoded = jsonwebtoken_1.default.verify(token, secret);
    }
    catch (err) {
        return next(new errors_1.UnauthorizedError('Invalid token or token has expired.'));
    }
    // 3) Check if user still exists
    const currentUser = await db_1.default.user.findUnique({
        where: { id: decoded.id },
        select: {
            id: true,
            email: true,
            role: true,
            name: true,
        },
    });
    if (!currentUser) {
        return next(new errors_1.UnauthorizedError('The user belonging to this token no longer exists.'));
    }
    // 4) Grant access to protected route
    req.user = currentUser;
    next();
});
const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return next(new errors_1.ForbiddenError('You do not have permission to perform this action.'));
        }
        next();
    };
};
exports.restrictTo = restrictTo;
