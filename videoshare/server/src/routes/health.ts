import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';

const router = Router();

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

// Always answers 200 (so Render's health check does not restart the service when
// the database blips) but reports the database state for diagnostics.
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    database: DB_STATES[mongoose.connection.readyState] || 'unknown',
    uptimeSeconds: Math.round(process.uptime()),
  });
});

export default router;
