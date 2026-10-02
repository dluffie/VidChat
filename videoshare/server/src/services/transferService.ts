import { Transfer, ITransfer, TransferStatus } from '../models/Transfer.js';

export interface InitTransferParams {
  transferId: string;
  sessionId: string;
  senderDeviceId: string;
  receiverDeviceId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  chunkSize: number;
  encoding?: string;
  checksum: string;
}

export class TransferService {
  /**
   * Register a new video transfer session
   */
  static async initTransfer(params: InitTransferParams): Promise<ITransfer> {
    const existing = await Transfer.findOne({ transferId: params.transferId });
    if (existing) {
      return existing;
    }

    const transfer = await Transfer.create({
      transferId: params.transferId,
      sessionId: params.sessionId,
      senderDeviceId: params.senderDeviceId,
      receiverDeviceId: params.receiverDeviceId,
      fileName: params.fileName,
      fileSize: params.fileSize,
      mimeType: params.mimeType,
      totalChunks: params.totalChunks,
      chunkSize: params.chunkSize,
      encoding: params.encoding || 'base64',
      checksum: params.checksum,
      status: 'transferring',
    });

    return transfer;
  }

  /**
   * Update transfer status (e.g. completed, failed, cancelled)
   */
  static async updateStatus(
    transferId: string,
    status: TransferStatus
  ): Promise<ITransfer | null> {
    const updateData: { status: TransferStatus; completedAt?: Date } = { status };
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }

    return Transfer.findOneAndUpdate(
      { transferId },
      updateData,
      { new: true }
    );
  }

  /**
   * Get transfer metadata
   */
  static async getTransfer(transferId: string): Promise<ITransfer | null> {
    return Transfer.findOne({ transferId });
  }
}
