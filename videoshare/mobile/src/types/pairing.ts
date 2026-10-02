export interface DeviceStorageInfo {
  freeBytes: number;
  totalBytes: number;
  freeFormatted: string;
  totalFormatted: string;
}

export interface PairingState {
  deviceId: string;
  sessionId: string | null;
  pairingCode: string | null;
  expiresAt: string | null;
  isPaired: boolean;
  partnerDeviceId: string | null;
  sessionToken: string | null;
  role: 'creator' | 'joiner' | null;
  partnerStorage?: DeviceStorageInfo | null;
}

export interface PairCreateResponse {
  action: 'pair:created';
  sessionId: string;
  pairingCode: string;
  expiresAt: string;
  sessionToken: string;
}

export interface PairSuccessResponse {
  action: 'pair:success';
  sessionId: string;
  deviceA: string;
  deviceB: string;
  sessionToken: string;
  role?: 'creator' | 'joiner';
  storage?: DeviceStorageInfo;
  receiverStorage?: DeviceStorageInfo;
}
