import http from 'http';
import mongoose from 'mongoose';
import { WebSocketServer } from 'ws';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { WebSocketManager } from './websocket/wsManager.js';

async function bootstrap() {
  console.log(`[Server] Starting VideoShare Backend Server...`);
  console.log(`[Server] Environment: ${config.nodeEnv}`);

  // Connect to MongoDB
  try {
    console.log(`[Database] Connecting to MongoDB at ${config.mongoUri}...`);
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[Database] Connected successfully to MongoDB`);
  } catch (err: any) {
    console.warn(`[Database] Warning: Could not connect to MongoDB: ${err.message}`);
    console.warn(`[Database] Server will proceed; ensure MONGODB_URI is reachable in production/Render.`);
  }

  const app = createApp();
  const server = http.createServer(app);

  // Attach WebSocket Server at path /ws
  const wss = new WebSocketServer({ server, path: '/ws' });
  const wsManager = new WebSocketManager(wss);

  server.listen(config.port, config.host, () => {
    console.log(`[Server] Listening on http://${config.host}:${config.port}`);
    console.log(`[Server] WebSocket endpoint available at ws://${config.host}:${config.port}/ws`);
    console.log(`[Server] Health check available at http://${config.host}:${config.port}/health`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`[Server] Received ${signal}. Shutting down gracefully...`);
    wsManager.close();
    server.close(() => {
      console.log(`[Server] HTTP and WS server closed.`);
    });
    try {
      await mongoose.disconnect();
      console.log(`[Database] MongoDB connection closed.`);
    } catch (_) {}
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
