export type MessageStatus = 'SENDING' | 'SENT' | 'DELIVERED' | 'READ';

export interface ChatMessage {
  messageId: string;
  sessionId: string;
  senderDeviceId: string;
  receiverDeviceId: string;
  type: 'text';
  text: string;
  timestamp: number | string;
  status: MessageStatus;
}

export interface SendMessagePayload {
  messageId: string;
  sessionId: string;
  senderDeviceId: string;
  receiverDeviceId?: string;
  type: 'text';
  text: string;
  timestamp: number;
}
