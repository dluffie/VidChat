import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import healthRouter from './routes/health.js';
import apiRouter from './routes/api.js';

export function createApp(): Express {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({ origin: '*' })); // Configure appropriately for mobile/web access
  app.use(express.json({ limit: '1mb' })); // Low JSON limit on server to prevent loading large payloads

  // Routes
  app.use(healthRouter);
  app.use('/api', apiRouter);

  return app;
}
