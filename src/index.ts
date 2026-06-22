import dotenv from 'dotenv';
// Load environment variables first
dotenv.config();

import app from './app';
import prisma from './config/db';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Test the database connection
    await prisma.$connect();
    console.log('🐘 Database connection established successfully.');

    // Start server with port conflict recovery: try PORT..PORT+5, otherwise pick an ephemeral port (0)
    const startListening = (basePort: number) => new Promise<import('http').Server>((resolve, reject) => {
      let attempt = 0;
      const maxAttempts = 5;
      const tryListen = () => {
        const p = basePort + attempt;
        const srv = app.listen(p, () => {
          console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${p}`);
          resolve(srv);
        }).on('error', (err: any) => {
          if (err && err.code === 'EADDRINUSE' && attempt < maxAttempts) {
            attempt++;
            console.warn(`Port ${p} in use, trying ${basePort + attempt}...`);
            setTimeout(tryListen, 200);
            return;
          }

          // If we've exhausted attempts or received a non-EADDRINUSE error, try binding to an ephemeral port (0)
          try {
            console.warn(`Port attempts exhausted or unexpected error (${err?.code || err}). Falling back to ephemeral port.`);
            const alt = app.listen(0, () => {
              // @ts-ignore
              const assigned = (alt.address && typeof alt.address === 'function') ? undefined : (alt.address as any)?.port;
              // Node's Server.address() may be an object; safely extract port
              let portNum: number | undefined;
              try { const info = alt.address(); portNum = info && typeof info === 'object' ? (info as any).port : undefined; } catch (_) { portNum = undefined; }
              console.log(`🚀 Server running (ephemeral) in ${process.env.NODE_ENV} mode on port ${portNum || '(unknown)'}`);
              resolve(alt);
            }).on('error', (e: any) => {
              reject(e || err);
            });
          } catch (e) {
            reject(err);
          }
        });
      };
      tryListen();
    });

    const server = await startListening(Number(PORT));

    // Handle graceful shutdown
    const shutdown = async () => {
      console.log('Shutting down server...');
      server.close(async () => {
        await prisma.$disconnect();
        console.log('Database connection closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    // If the database connection fails, do not crash the whole server during development.
    // Instead, log a helpful message and start the app without a database connection.
    console.error('⚠️ Database connection failed. Starting server without DB connection.');
    console.error(error instanceof Error ? error.message : String(error));

    console.log('\nHelpful tips:');
    console.log('- Ensure Postgres is running (you can run `docker-compose up -d` from the `backend/` folder).');
    console.log('- Verify `DATABASE_URL` in backend/.env or your environment variables. Example:');
    console.log("  DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5432/backend_db?schema=public\n");

    // Start the server anyway so frontend and other static endpoints remain available for development.
    try {
      const server = await startListening(Number(PORT));

      // graceful shutdown still attempts to disconnect if possible
      const shutdown = async () => {
        console.log('Shutting down server...');
        server.close(async () => {
          try { await prisma.$disconnect(); } catch (_) {}
          console.log('Server stopped.');
          process.exit(0);
        });
      };

      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
    } catch (startErr) {
      console.error('❌ Failed to start the HTTP server:', startErr instanceof Error ? startErr.message : String(startErr));
      process.exit(1);
    }
  }
}

// Handle unhandled rejections and exceptions globally
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message, err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (err: any) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err?.name, err?.message, err?.stack);
  process.exit(1);
});

startServer();
