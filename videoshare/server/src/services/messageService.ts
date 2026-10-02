import { v4 as uuidv4 } from 'uuid';
import { Message, IMessage, MessageStatus } from '../models/Message.js';

export class MessageService {
  /**
   * Save a newly sent text message
   */
  static async saveMessage(params: {
    messageId?: string;
    sessionId: string;
    senderDeviceId: string;
    receiverDeviceId: string;
    text: string;
    timestamp?: Date;
    status?: MessageStatus;
  }): Promise<IMessage> {
    const message = await Message.create({
      messageId: params.messageId || uuidv4(),
      sessionId: params.sessionId,
      senderDeviceId: params.senderDeviceId,
      receiverDeviceId: params.receiverDeviceId,
      type: 'text',
      text: params.text,
      timestamp: params.timestamp || new Date(),
      status: params.status || 'SENT',
    });

    return message;
  }

  /**
   * Update message status (e.g. DELIVERED, READ)
   */
  static async updateStatus(messageId: string, status: MessageStatus): Promise<IMessage | null> {
    const message = await Message.findOneAndUpdate(
      { messageId },
      { status },
      { new: true }
    );
    return message;
  }

  /**
   * Mark all unread messages for a recipient in a session as READ
   */
  static async markSessionMessagesRead(
    sessionId: string,
    receiverDeviceId: string
  ): Promise<string[]> {
    const unread = await Message.find({
      sessionId,
      receiverDeviceId,
      status: { $in: ['SENT', 'DELIVERED'] },
    }).select('messageId');

    const ids = unread.map((m) => m.messageId);

    if (ids.length > 0) {
      await Message.updateMany(
        { messageId: { $in: ids } },
        { status: 'READ' }
      );
    }

    return ids;
  }

  /**
   * Get pending undelivered messages when a device reconnects
   */
  static async getPendingMessages(
    sessionId: string,
    receiverDeviceId: string
  ): Promise<IMessage[]> {
    return Message.find({
      sessionId,
      receiverDeviceId,
      status: 'SENT',
    }).sort({ timestamp: 1 });
  }

  /**
   * Get recent messages for session history
   */
  static async getSessionHistory(
    sessionId: string,
    limit: number = 100
  ): Promise<IMessage[]> {
    return Message.find({ sessionId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .then((docs) => docs.reverse());
  }
}
