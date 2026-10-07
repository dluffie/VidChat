import { v4 as uuidv4 } from 'uuid';
import { WebSocketClient } from './websocket';
import { PairingState, PairCreateResponse, PairSuccessResponse } from '../types/pairing';

// Local storage cache simulation (in React Native can be AsyncStorage or Keychain)
let localPairingCache: PairingState = {
  deviceId: uuidv4(),
  sessionId: null,
  pairingCode: null,
  expiresAt: null,
  isPaired: false,
  partnerDeviceId: null,
  sessionToken: null,
  role: null,
};

export class PairingService {
  private static ws = WebSocketClient.getInstance();
  private static pairSuccessListenerActive = false;

  static getDeviceId(): string {
    return localPairingCache.deviceId;
  }

  static getPairingState(): PairingState {
    return { ...localPairingCache };
  }

  static setPairingState(state: Partial<PairingState>) {
    localPairingCache = { ...localPairingCache, ...state };
  }

  /**
   * Listen for pair:success events (triggered for both creator and joiner).
   * Ensures the creator's local cache is also updated with partner info.
   * Should be called early (e.g. from HomeScreen or PairScreen).
   */
  static initPairSuccessListener() {
    if (this.pairSuccessListenerActive) return;
    this.pairSuccessListenerActive = true;

    this.ws.on('pair:success', (res: PairSuccessResponse) => {
      localPairingCache.sessionId = res.sessionId;
      localPairingCache.isPaired = true;
      localPairingCache.sessionToken = res.sessionToken;
      localPairingCache.partnerDeviceId =
        res.deviceA === localPairingCache.deviceId ? res.deviceB : res.deviceA;
      localPairingCache.role = res.role === 'joiner' ? 'joiner' : 'creator';
      if (res.receiverStorage) {
        localPairingCache.partnerStorage = res.receiverStorage;
      }
    });

    this.ws.on('storage:info', (res: { storage: any }) => {
      if (res.storage) {
        localPairingCache.partnerStorage = res.storage;
      }
    });
  }

  /**
   * Device A requests pairing code creation
   */
  static async createPair(): Promise<PairCreateResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.ws.off('pair:created', onCreated);
        this.ws.off('error', onError);
        reject(new Error('Pairing code creation timed out'));
      }, 10000);

      const onCreated = (res: PairCreateResponse) => {
        clearTimeout(timeout);
        this.ws.off('pair:created', onCreated);
        this.ws.off('error', onError);

        localPairingCache.sessionId = res.sessionId;
        localPairingCache.pairingCode = res.pairingCode;
        localPairingCache.expiresAt = res.expiresAt;
        localPairingCache.sessionToken = res.sessionToken;
        localPairingCache.role = 'creator';

        resolve(res);
      };

      const onError = (err: any) => {
        clearTimeout(timeout);
        this.ws.off('pair:created', onCreated);
        this.ws.off('error', onError);
        reject(new Error(err.message || 'Failed to create pairing'));
      };

      this.ws.on('pair:created', onCreated);
      this.ws.on('error', onError);

      this.ws.send({
        action: 'pair:create',
        deviceId: localPairingCache.deviceId,
      });
    });
  }

  /**
   * Device B joins pair with 6-digit code and reports its available storage
   */
  static async joinPair(pairingCode: string, storage?: any): Promise<PairSuccessResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.ws.off('pair:success', onSuccess);
        this.ws.off('error', onError);
        reject(new Error('Joining pair timed out'));
      }, 10000);

      const onSuccess = (res: PairSuccessResponse) => {
        clearTimeout(timeout);
        this.ws.off('pair:success', onSuccess);
        this.ws.off('error', onError);

        localPairingCache.sessionId = res.sessionId;
        localPairingCache.isPaired = true;
        localPairingCache.sessionToken = res.sessionToken;
        localPairingCache.partnerDeviceId = res.deviceA;
        localPairingCache.role = 'joiner';

        resolve(res);
      };

      const onError = (err: any) => {
        clearTimeout(timeout);
        this.ws.off('pair:success', onSuccess);
        this.ws.off('error', onError);
        reject(new Error(err.message || 'Invalid or expired code'));
      };

      this.ws.on('pair:success', onSuccess);
      this.ws.on('error', onError);

      this.ws.send({
        action: 'pair:join',
        deviceId: localPairingCache.deviceId,
        pairingCode: pairingCode.trim(),
        storage,
      });
    });
  }

  /**
   * Sends or updates storage info to paired peer
   */
  static sendStorageInfo(storage: any) {
    if (localPairingCache.sessionId) {
      this.ws.send({
        action: 'storage:info',
        sessionId: localPairingCache.sessionId,
        senderDeviceId: localPairingCache.deviceId,
        storage,
      });
    }
  }

  /**
   * Re-authenticate active session on reconnect
   */
  static authenticateActiveSession() {
    if (localPairingCache.sessionId && localPairingCache.sessionToken) {
      this.ws.send({
        action: 'auth',
        sessionId: localPairingCache.sessionId,
        sessionToken: localPairingCache.sessionToken,
        deviceId: localPairingCache.deviceId,
      });
    }
  }

  /**
   * Reset pairing state (e.g. unpair)
   */
  static resetPairing() {
    localPairingCache = {
      deviceId: localPairingCache.deviceId,
      sessionId: null,
      pairingCode: null,
      expiresAt: null,
      isPaired: false,
      partnerDeviceId: null,
      sessionToken: null,
      role: null,
      partnerStorage: null,
    };
  }
}
