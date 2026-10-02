import mongoose, { Document, Schema } from 'mongoose';

export type MessageStatus = 'SENDING' | 'SENT' | 'DELIVERED' | 'READ';
export type MessageType = 'text';

export interface IMessage extends Document {
  messageId: string;
  sessionId: string;
  senderDeviceId: string;
  receiverDeviceId: string;
  type: MessageType;
  text: string;
  timestamp: Date;
  status: MessageStatus;
}

const MessageSchema = new Schema<IMessage>(
  {
    messageId: { type: String, required: true, unique: true, index: true },
    sessionId: { type: String, required: true, index: true },
    senderDeviceId: { type: String, required: true, index: true },
    receiverDeviceId: { type: String, required: true, index: true },
    type: { type: String, enum: ['text'], default: 'text' },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now, index: true },
    status: {
      type: String,
      enum: ['SENDING', 'SENT', 'DELIVERED', 'READ'],
      default: 'SENT',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying undelivered messages per session & receiver
MessageSchema.index({ sessionId: 1, receiverDeviceId: 1, status: 1 });

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
