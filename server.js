import app from './src/app.js';
import { connectDB } from './src/config/db.js';
import { env } from './src/config/env.js';

async function start() {
  try {
    await connectDB();

    const server = app.listen(env.PORT, () => {
      console.log(`[server] CareerOS backend running on port ${env.PORT} (${env.NODE_ENV})`);
    });

    // Graceful shutdown
    const shutdown = (signal) => {
      console.log(`[server] ${signal} received, shutting down gracefully...`);
      server.close(() => process.exit(0));
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('[server] Failed to start:', err.message);
    process.exit(1);
  }
}

start();
