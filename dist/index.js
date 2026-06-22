"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables first
dotenv_1.default.config();
const app_1 = __importDefault(require("./app"));
const db_1 = __importDefault(require("./config/db"));
const PORT = process.env.PORT || 5000;
async function startServer() {
    try {
        // Test the database connection
        await db_1.default.$connect();
        console.log('🐘 Database connection established successfully.');
        const server = app_1.default.listen(PORT, () => {
            console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
        });
        // Handle graceful shutdown
        const shutdown = async () => {
            console.log('Shutting down server...');
            server.close(async () => {
                await db_1.default.$disconnect();
                console.log('Database connection closed.');
                process.exit(0);
            });
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    }
    catch (error) {
        console.error('❌ Failed to start the server:', error);
        process.exit(1);
    }
}
// Handle unhandled rejections and exceptions globally
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
    console.error(err.name, err.message, err.stack);
    process.exit(1);
});
process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION! 💥 Shutting down...');
    console.error(err?.name, err?.message, err?.stack);
    process.exit(1);
});
startServer();
