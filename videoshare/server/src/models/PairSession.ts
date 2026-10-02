import mongoose, { Document, Schema } from 'mongoose';

export type SessionStatus = 'pending' | 'paired' | 'expired' | 'terminated';

export interface IPairSession extends Document {
  sessionId: string;
  deviceA: string;
  deviceB?: string;
  pairingCodeHash?: string;
  sessionTokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  status: SessionStatus;
}

const PairSessionSchema = new Schema<IPairSession>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    deviceA: { type: String, required: true, index: true },
    deviceB: { type: String, default: null, index: true },
    pairingCodeHash: { type: String, default: null, index: true },
    sessionTokenHash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    status: {
      type: String,
      enum: ['pending', 'paired', 'expired', 'terminated'],
      default: 'pending',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const PairSession = mongoose.model<IPairSession>('PairSession', PairSessionSchema);
