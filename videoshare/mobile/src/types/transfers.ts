export type TransferStatus =
  | 'idle'
  | 'initiating'
  | 'transferring'
  | 'paused'
  | 'reconstructing'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface VideoTransferMeta {
  transferId: string;
  sessionId: string;
  senderDeviceId: string;
  receiverDeviceId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  chunkSize: number;
  encoding: 'base64';
  checksum: string;
}

export interface VideoChunk {
  transferId: string;
  chunkIndex: number;
  totalChunks: number;
  data: string;
  hash: string;
}

export interface ChunkAck {
  transferId: string;
  chunkIndex: number;
  status: 'received';
}

export interface TransferMetrics {
  originalSize: number;
  encodedSize: number;
  compressionRatio: number;
  totalChunks: number;
  elapsedSeconds: number;
  avgSpeedBytesPerSec: number;
  retransmittedBytes: number;
  finalHashVerified: boolean;
  sha256Result: string;
}

export interface TransferProgress {
  transferId: string;
  direction: 'outgoing' | 'incoming';
  fileName: string;
  fileSize: number;
  totalChunks: number;
  completedChunks: number;
  acknowledgedChunks?: number[];
  speedBytesPerSec: number;
  etaSeconds: number;
  percentage: number;
  status: TransferStatus;
  localFilePath?: string;
  checksum: string;
  error?: string;
  metrics?: TransferMetrics;
}
