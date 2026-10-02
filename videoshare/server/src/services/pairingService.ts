import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { PairSession, IPairSession } from '../models/PairSession.js';
import { config } from '../config/index.js';

export function hashString(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function generatePairingCode(): string {
  // 6-digit random number: 100000 to 999999
  return crypto.randomInt(100000, 1000000).toString();
}

export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export interface PairCreateResult {
  sessionId: string;
  pairingCode: string;
  expiresAt: Date;
  sessionToken: string;
}

export interface PairJoinResult {
  sessionId: string;
  deviceA: string;
  deviceB: string;
  sessionToken: string;
}

export class PairingService {
  /**
   * Device A initiates pairing
   */
  static async createPair(deviceA: string): Promise<PairCreateResult> {
    const sessionId = uuidv4();
    const pairingCode = generatePairingCode();
    const pairingCodeHash = hashString(pairingCode);
    const sessionToken = generateSecureToken();
    const sessionTokenHash = hashString(sessionToken);

    const expiresAt = new Date(Date.now() + config.pairingExpiryMinutes * 60 * 1000);

    await PairSession.create({
      sessionId,
      deviceA,
      pairingCodeHash,
      sessionTokenHash,
      expiresAt,
      status: 'pending',
    });

    return {
      sessionId,
      pairingCode,
      expiresAt,
      sessionToken,
    };
  }

  /**
   * Device B joins with the 6-digit pairing code
   */
  static async joinPair(pairingCode: string, deviceB: string): Promise<PairJoinResult> {
    const codeHash = hashString(pairingCode.trim());

    const session = await PairSession.findOne({
      pairingCodeHash: codeHash,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      throw new Error('Invalid or expired pairing code');
    }

    if (session.deviceA === deviceB) {
      throw new Error('Cannot pair with the same device');
    }

    // Invalidate the pairing code immediately so it can never be reused
    session.deviceB = deviceB;
    session.status = 'paired';
    session.pairingCodeHash = undefined; // clear code hash

    await session.save();

    // Generate fresh session token shared between the two devices
    const sessionToken = generateSecureToken();
    session.sessionTokenHash = hashString(sessionToken);
    await session.save();

    return {
      sessionId: session.sessionId,
      deviceA: session.deviceA,
      deviceB: session.deviceB!,
      sessionToken,
    };
  }

  /**
   * Authenticate session token and deviceId
   */
  static async validateSession(
    sessionId: string,
    sessionToken: string,
    deviceId: string
  ): Promise<IPairSession | null> {
    const session = await PairSession.findOne({
      sessionId,
      status: 'paired',
    });

    if (!session) return null;

    // Device must be either deviceA or deviceB
    if (session.deviceA !== deviceId && session.deviceB !== deviceId) {
      return null;
    }

    const tokenHash = hashString(sessionToken);
    if (session.sessionTokenHash !== tokenHash) {
      return null;
    }

    return session;
  }

  /**
   * Get the paired partner device ID
   */
  static getPartnerDeviceId(session: IPairSession, currentDeviceId: string): string | null {
    if (session.deviceA === currentDeviceId) {
      return session.deviceB || null;
    }
    if (session.deviceB === currentDeviceId) {
      return session.deviceA;
    }
    return null;
  }
}
