import { Router, Request, Response } from 'express';
import { MessageService } from '../services/messageService.js';
import { TransferService } from '../services/transferService.js';
import { PairingService } from '../services/pairingService.js';

const router = Router();

// Validate session authentication middleware
async function authMiddleware(req: Request, res: Response, next: Function) {
  const sessionId = req.headers['x-session-id'] as string;
  const sessionToken = req.headers['x-session-token'] as string;
  const deviceId = req.headers['x-device-id'] as string;

  if (!sessionId || !sessionToken || !deviceId) {
    res.status(401).json({ error: 'Missing authentication headers' });
    return;
  }

  const session = await PairingService.validateSession(sessionId, sessionToken, deviceId);
  if (!session) {
    res.status(401).json({ error: 'Invalid session credentials' });
    return;
  }

  (req as any).session = session;
  next();
}

// Get message history for active paired session
router.get('/messages', authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionId = (req as any).session.sessionId;
    const limit = parseInt(req.query.limit as string) || 100;
    const history = await MessageService.getSessionHistory(sessionId, limit);
    res.status(200).json({ messages: history });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get transfer metadata
router.get('/transfers/:transferId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const transfer = await TransferService.getTransfer(req.params.transferId);
    if (!transfer) {
      res.status(404).json({ error: 'Transfer not found' });
      return;
    }
    res.status(200).json({ transfer });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
