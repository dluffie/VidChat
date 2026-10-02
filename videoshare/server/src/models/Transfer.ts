import mongoose, { Document, Schema } from 'mongoose';

export type TransferStatus =
  | 'pending'
  | 'transferring'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ITransfer extends Document {
  transferId: string;
  sessionId: string;
  senderDeviceId: string;
  receiverDeviceId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  chunkSize: number;
  encoding: string;
  checksum: string;
  status: TransferStatus;
  createdAt: Date;
  completedAt?: Date;
}

const TransferSchema = new Schema<ITransfer>(
  {
    transferId: { type: String, required: true, unique: true, index: true },
    sessionId: { type: String, required: true, index: true },
    senderDeviceId: { type: String, required: true, index: true },
    receiverDeviceId: { type: String, required: true, index: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, default: 'video/mp4' },
    totalChunks: { type: Number, required: true },
    chunkSize: { type: Number, required: true },
    encoding: { type: String, default: 'base64' },
    checksum: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'transferring', 'paused', 'completed', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    createdAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Note: No large video content or Base64 payloads are stored in MongoDB!
export const Transfer = mongoose.model<ITransfer>('Transfer', TransferSchema);
