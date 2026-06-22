"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const routes_1 = __importDefault(require("./routes"));
const error_1 = require("./middlewares/error");
const errors_1 = require("./utils/errors");
const app = (0, express_1.default)();
exports.app = app;
// 1) Global Middlewares
// Set security HTTP headers
app.use((0, helmet_1.default)());
// Development logging
if (process.env.NODE_ENV === 'development') {
    app.use((0, morgan_1.default)('dev'));
}
// Enable CORS
app.use((0, cors_1.default)());
// Body parser, reading data from body into req.body
app.use(express_1.default.json({ limit: '10kb' }));
// 2) API Routes
app.use('/api/v1', routes_1.default);
// 3) Handle undefined routes (404)
app.all('*', (req, res, next) => {
    next(new errors_1.NotFoundError(`Can't find ${req.originalUrl} on this server!`));
});
// 4) Global Error Handler Middleware
app.use(error_1.errorHandler);
exports.default = app;
