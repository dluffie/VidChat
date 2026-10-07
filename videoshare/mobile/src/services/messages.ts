import { v4 as uuidv4 } from 'uuid';
import { WebSocketClient } from './websocket';
import { PairingService } from './pairing';
import { ChatMessage } from '../types/messages';

export class MessageClientService {
  private static ws = WebSocketClient.getInstance();

  /**
   * Send a normal text message through the chat transport
   */
  static sendTextMessage(text: string): ChatMessage {
    const pairState = PairingService.getPairingState();
    if (!pairState.sessionId || !pairState.partnerDeviceId) {
      throw new Error('Device is not paired with a recipient');
    }

    const message: ChatMessage = {
      messageId: uuidv4(),
      sessionId: pairState.sessionId,
      senderDeviceId: pairState.deviceId,
      receiverDeviceId: pairState.partnerDeviceId,
      type: 'text',
      text,
      timestamp: Date.now(),
      status: 'SENDING',
    };

    // Send via WebSocket chat transport
    const sent = this.ws.send({
      action: 'message:send',
      messageId: message.messageId,
      sessionId: message.sessionId,
      senderDeviceId: message.senderDeviceId,
      receiverDeviceId: message.receiverDeviceId,
      type: message.type,
      text: message.text,
      timestamp: message.timestamp,
    });

    if (sent) {
      message.status = 'SENT';
    }

    return message;
  }

  /**
   * Mark messages as read by current device
   */
  static markAsRead(messageIds: string[]) {
    const pairState = PairingService.getPairingState();
    if (!pairState.sessionId) return;

    this.ws.send({
      action: 'message:read',
      sessionId: pairState.sessionId,
      deviceId: pairState.deviceId,
      messageIds,
    });
  }
}
