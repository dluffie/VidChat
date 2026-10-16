import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { PairingService } from '../services/pairingService.js';
import { MessageService } from '../services/messageService.js';
import { TransferService } from '../services/transferService.js';
import { PairSession } from '../models/PairSession.js';
import {
  PairCreateSchema,
  PairJoinSchema,
  StorageInfoSchema,
  AuthSchema,
  MessageSendSchema,
  MessageReadSchema,
  VideoStartSchema,
  VideoChunkSchema,
  VideoAckSchema,
  VideoRequestMissingSchema,
  VideoCompleteSchema,
  VideoCancelSchema,
} from './schemas.js';

interface ClientConnection {
  ws: WebSocket;
  deviceId: string;
  sessionId?: string;
  isAlive: boolean;
  /** Last time this socket delivered a frame, used to spare busy connections. */
  lastActivityAt: number;
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<string, ClientConnection> = new Map(); // deviceId -> ClientConnection
  private sessionClients: Map<string, Set<string>> = new Map(); // sessionId -> Set<deviceId>
  private heartbeatInterval: NodeJS.Timeout | null = null;

  // transferId -> routing info. Cached in memory so that routing a chunk does not
  // require a MongoDB round-trip (with 64 KB chunks that is one query per frame).
  private transferRoutes: Map<string, { senderDeviceId: string; receiverDeviceId: string }> =
    new Map();

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.init();
  }

  private init() {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      let clientDeviceId: string | null = null;

      ws.on('pong', () => {
        if (clientDeviceId && this.clients.has(clientDeviceId)) {
          this.clients.get(clientDeviceId)!.isAlive = true;
        }
      });

      const processMessage = async (data: Buffer | string) => {
        try {
          const raw = typeof data === 'string' ? data : data.toString('utf-8');
          const payload = JSON.parse(raw);
          const action = payload.action;

          switch (action) {
            case 'ping': {
              this.safeSend(ws, { action: 'pong', timestamp: Date.now() });
              break;
            }

            case 'pair:create': {
              const parsed = PairCreateSchema.parse(payload);
              clientDeviceId = parsed.deviceId;
              this.registerClient(ws, parsed.deviceId);

              const result = await PairingService.createPair(parsed.deviceId);
              this.associateSession(parsed.deviceId, result.sessionId);

              this.safeSend(ws, {
                action: 'pair:created',
                sessionId: result.sessionId,
                pairingCode: result.pairingCode,
                expiresAt: result.expiresAt,
                sessionToken: result.sessionToken,
              });
              break;
            }

            case 'pair:join': {
              const parsed = PairJoinSchema.parse(payload);
              clientDeviceId = parsed.deviceId;
              this.registerClient(ws, parsed.deviceId);

              try {
                const result = await PairingService.joinPair(parsed.pairingCode, parsed.deviceId);
                this.associateSession(parsed.deviceId, result.sessionId);

                // Notify joining device (Device B)
                this.safeSend(ws, {
                  action: 'pair:success',
                  sessionId: result.sessionId,
                  deviceA: result.deviceA,
                  deviceB: result.deviceB,
                  sessionToken: result.sessionToken,
                  role: 'joiner',
                  storage: parsed.storage,
                });

                // Notify creator device (Device A) if online, including receiver's storage info
                const deviceAConn = this.clients.get(result.deviceA);
                if (deviceAConn && deviceAConn.ws.readyState === WebSocket.OPEN) {
                  this.safeSend(deviceAConn.ws, {
                    action: 'pair:success',
                    sessionId: result.sessionId,
                    deviceA: result.deviceA,
                    deviceB: result.deviceB,
                    sessionToken: result.sessionToken,
                    role: 'creator',
                    receiverStorage: parsed.storage,
                  });
                }
              } catch (err: any) {
                this.safeSend(ws, {
                  action: 'error',
                  code: 'PAIR_FAILED',
                  message: err.message || 'Pairing failed',
                });
              }
              break;
            }

            case 'storage:info': {
              const parsed = StorageInfoSchema.parse(payload);
              const session = await PairSession.findOne({ sessionId: parsed.sessionId, status: 'paired' });
              if (session) {
                const partnerDeviceId = PairingService.getPartnerDeviceId(session, parsed.senderDeviceId);
                if (partnerDeviceId && this.clients.has(partnerDeviceId)) {
                  const partnerConn = this.clients.get(partnerDeviceId);
                  if (partnerConn && partnerConn.ws.readyState === WebSocket.OPEN) {
                    this.safeSend(partnerConn.ws, {
                      action: 'storage:info',
                      senderDeviceId: parsed.senderDeviceId,
                      storage: parsed.storage,
                    });
                  }
                }
              }
              break;
            }

            case 'auth': {
              const parsed = AuthSchema.parse(payload);
              clientDeviceId = parsed.deviceId;

              const session = await PairingService.validateSession(
                parsed.sessionId,
                parsed.sessionToken,
                parsed.deviceId
              );

              if (!session) {
                this.safeSend(ws, {
                  action: 'error',
                  code: 'AUTH_FAILED',
                  message: 'Invalid session or authentication token',
                });
                return;
              }

              this.registerClient(ws, parsed.deviceId);
              this.associateSession(parsed.deviceId, session.sessionId);

              const partnerDeviceId = PairingService.getPartnerDeviceId(session, parsed.deviceId);
              const partnerOnline = !!(partnerDeviceId && this.clients.has(partnerDeviceId));

              this.safeSend(ws, {
                action: 'auth:success',
                sessionId: session.sessionId,
                partnerDeviceId,
                partnerOnline,
              });

              // Notify partner that this device is online
              if (partnerDeviceId && partnerOnline) {
                const partnerConn = this.clients.get(partnerDeviceId);
                if (partnerConn && partnerConn.ws.readyState === WebSocket.OPEN) {
                  this.safeSend(partnerConn.ws, {
                    action: 'peer:status',
                    status: 'online',
                    peerDeviceId: parsed.deviceId,
                  });
                }
              }

              // Deliver any undelivered offline text messages
              await this.deliverPendingMessages(session.sessionId, parsed.deviceId, ws);
              break;
            }

            case 'message:send': {
              const parsed = MessageSendSchema.parse(payload);
              const session = await PairSession.findOne({ sessionId: parsed.sessionId, status: 'paired' });
              if (!session) {
                this.safeSend(ws, { action: 'error', code: 'INVALID_SESSION', message: 'Session not found' });
                return;
              }

              const partnerDeviceId = PairingService.getPartnerDeviceId(session, parsed.senderDeviceId);
              if (!partnerDeviceId) {
                this.safeSend(ws, { action: 'error', code: 'NO_PARTNER', message: 'No paired partner found' });
                return;
              }

              const partnerConn = this.clients.get(partnerDeviceId);
              const isPartnerOnline = partnerConn && partnerConn.ws.readyState === WebSocket.OPEN;

              // Save message to MongoDB
              const savedMessage = await MessageService.saveMessage({
                messageId: parsed.messageId,
                sessionId: parsed.sessionId,
                senderDeviceId: parsed.senderDeviceId,
                receiverDeviceId: partnerDeviceId,
                text: parsed.text,
                status: isPartnerOnline ? 'DELIVERED' : 'SENT',
              });

              // Confirm to sender that message reached the server
              this.safeSend(ws, {
                action: 'message:sent',
                messageId: savedMessage.messageId,
                status: savedMessage.status,
                timestamp: savedMessage.timestamp,
              });

              // Forward to partner immediately if online
              if (isPartnerOnline) {
                this.safeSend(partnerConn!.ws, {
                  action: 'message:new',
                  messageId: savedMessage.messageId,
                  sessionId: savedMessage.sessionId,
                  senderDeviceId: savedMessage.senderDeviceId,
                  receiverDeviceId: savedMessage.receiverDeviceId,
                  type: 'text',
                  text: savedMessage.text,
                  timestamp: savedMessage.timestamp,
                  status: 'DELIVERED',
                });

                // Also notify sender of delivery
                this.safeSend(ws, {
                  action: 'message:delivered',
                  messageId: savedMessage.messageId,
                  deliveredTo: partnerDeviceId,
                });
              }
              break;
            }

            case 'message:read': {
              const parsed = MessageReadSchema.parse(payload);
              const readIds = await MessageService.markSessionMessagesRead(
                parsed.sessionId,
                parsed.deviceId
              );

              // Notify the sender that messages were read
              const session = await PairSession.findOne({ sessionId: parsed.sessionId });
              if (session) {
                const partnerDeviceId = PairingService.getPartnerDeviceId(session, parsed.deviceId);
                if (partnerDeviceId && this.clients.has(partnerDeviceId)) {
                  const partnerConn = this.clients.get(partnerDeviceId);
                  if (partnerConn && partnerConn.ws.readyState === WebSocket.OPEN) {
                    this.safeSend(partnerConn.ws, {
                      action: 'message:read',
                      messageIds: parsed.messageIds || readIds,
                      readBy: parsed.deviceId,
                    });
                  }
                }
              }
              break;
            }

            case 'video:start': {
              const parsed = VideoStartSchema.parse(payload);
              const session = await PairSession.findOne({ sessionId: parsed.sessionId, status: 'paired' });
              if (!session) {
                this.safeSend(ws, { action: 'video:error', transferId: parsed.transferId, error: 'Session not found' });
                return;
              }

              const partnerDeviceId = PairingService.getPartnerDeviceId(session, parsed.senderDeviceId);
              if (!partnerDeviceId) {
                this.safeSend(ws, { action: 'video:error', transferId: parsed.transferId, error: 'Partner not paired' });
                return;
              }

              // Register transfer metadata in MongoDB (best effort; routing below
              // uses the in-memory cache so the chunk path never hits the DB).
              try {
                await TransferService.initTransfer({
                  transferId: parsed.transferId,
                  sessionId: parsed.sessionId,
                  senderDeviceId: parsed.senderDeviceId,
                  receiverDeviceId: partnerDeviceId,
                  fileName: parsed.fileName,
                  fileSize: parsed.fileSize,
                  mimeType: parsed.mimeType,
                  totalChunks: parsed.totalChunks,
                  chunkSize: parsed.chunkSize,
                  encoding: parsed.encoding,
                  checksum: parsed.checksum,
                });
              } catch (err: any) {
                console.error('[WS] Failed to register transfer:', err?.message || err);
                // A database blip must not end the user's transfer. Mark it
                // retryable and let the sender re-announce.
                this.safeSend(ws, {
                  action: 'video:error',
                  transferId: parsed.transferId,
                  error: `Could not register transfer: ${err?.message || 'database error'}`,
                  code: 'REGISTER_FAILED',
                  fatal: false,
                });
                return;
              }

              // Cache routing info immediately so chunks can be relayed without
              // touching the database.
              this.transferRoutes.set(parsed.transferId, {
                senderDeviceId: parsed.senderDeviceId,
                receiverDeviceId: partnerDeviceId,
              });

              // Forward metadata to receiver
              const partnerConn = this.clients.get(partnerDeviceId);
              if (partnerConn && partnerConn.ws.readyState === WebSocket.OPEN) {
                this.safeSend(partnerConn.ws, {
                  action: 'video:start',
                  transferId: parsed.transferId,
                  sessionId: parsed.sessionId,
                  senderDeviceId: parsed.senderDeviceId,
                  fileName: parsed.fileName,
                  fileSize: parsed.fileSize,
                  mimeType: parsed.mimeType,
                  totalChunks: parsed.totalChunks,
                  chunkSize: parsed.chunkSize,
                  encoding: parsed.encoding,
                  checksum: parsed.checksum,
                });
              } else {
                // Retryable: the receiver's socket is not up yet (still pairing,
                // or reconnecting). The sender keeps the transfer armed.
                this.safeSend(ws, {
                  action: 'video:error',
                  transferId: parsed.transferId,
                  error: 'Partner is currently offline. Waiting for it to return.',
                  code: 'PEER_OFFLINE',
                  fatal: false,
                });
              }
              break;
            }

            case 'video:chunk': {
              const parsed = VideoChunkSchema.parse(payload);
              // Hot path: resolved from the in-memory cache, no DB round-trip.
              const transfer = await this.resolveTransfer(parsed.transferId);
              if (!transfer) {
                // The server may have restarted (or been redeployed) since the
                // handshake. That is recoverable: the sender replays video:start.
                this.safeSend(ws, {
                  action: 'video:error',
                  transferId: parsed.transferId,
                  error: 'Transfer not found',
                  code: 'TRANSFER_NOT_FOUND',
                  fatal: false,
                });
                return;
              }

              // Route directly to receiver without buffering in RAM or DB!
              const partnerConn = this.clients.get(transfer.receiverDeviceId);
              if (partnerConn && partnerConn.ws.readyState === WebSocket.OPEN) {
                this.safeSend(partnerConn.ws, {
                  action: 'video:chunk',
                  transferId: parsed.transferId,
                  chunkIndex: parsed.chunkIndex,
                  totalChunks: parsed.totalChunks,
                  data: parsed.data,
                  hash: parsed.hash,
                });
              } else {
                // The receiver is momentarily unreachable (reconnecting, or its
                // socket is being replaced). Deliberately silent: an error per
                // dropped chunk would flood a 2G uplink and turn a brief blip into
                // a failed transfer. The sender's stall watchdog notices, backs
                // off, and the receiver re-requests whatever it missed once it is
                // back — exactly what TCP would do.
              }
              break;
            }

            case 'video:ack': {
              const parsed = VideoAckSchema.parse(payload);
              const transfer = await this.resolveTransfer(parsed.transferId);
              if (!transfer) return;

              // Forward acknowledgement back to sender
              const senderConn = this.clients.get(transfer.senderDeviceId);
              if (senderConn && senderConn.ws.readyState === WebSocket.OPEN) {
                this.safeSend(senderConn.ws, {
                  action: 'video:ack',
                  transferId: parsed.transferId,
                  chunkIndex: parsed.chunkIndex,
                  status: parsed.status,
                });
              }
              break;
            }

            case 'video:request_missing': {
              const parsed = VideoRequestMissingSchema.parse(payload);
              const transfer = await this.resolveTransfer(parsed.transferId);
              if (!transfer) return;

              // Forward missing indices list to sender
              const senderConn = this.clients.get(transfer.senderDeviceId);
              if (senderConn && senderConn.ws.readyState === WebSocket.OPEN) {
                this.safeSend(senderConn.ws, {
                  action: 'video:request_missing',
                  transferId: parsed.transferId,
                  missingIndices: parsed.missingIndices,
                });
              }
              break;
            }

            case 'video:complete': {
              const parsed = VideoCompleteSchema.parse(payload);
              const transfer = await this.resolveTransfer(parsed.transferId);
              if (!transfer) return;

              if (parsed.checksumVerified) {
                await TransferService.updateStatus(parsed.transferId, 'completed');
                // Notify sender that verification succeeded
                const senderConn = this.clients.get(transfer.senderDeviceId);
                if (senderConn && senderConn.ws.readyState === WebSocket.OPEN) {
                  this.safeSend(senderConn.ws, {
                    action: 'video:complete',
                    transferId: parsed.transferId,
                    status: 'verified',
                  });
                }
              } else {
                await TransferService.updateStatus(parsed.transferId, 'failed');
                const senderConn = this.clients.get(transfer.senderDeviceId);
                if (senderConn && senderConn.ws.readyState === WebSocket.OPEN) {
                  this.safeSend(senderConn.ws, {
                    action: 'video:error',
                    transferId: parsed.transferId,
                    error: 'SHA-256 verification failed on receiver',
                  });
                }
              }
              this.transferRoutes.delete(parsed.transferId);
              break;
            }

            case 'video:cancel': {
              const parsed = VideoCancelSchema.parse(payload);
              const transfer = await this.resolveTransfer(parsed.transferId);
              if (!transfer) return;

              await TransferService.updateStatus(parsed.transferId, 'cancelled');
              this.transferRoutes.delete(parsed.transferId);

              // Notify both sender and receiver
              const senderConn = this.clients.get(transfer.senderDeviceId);
              const receiverConn = this.clients.get(transfer.receiverDeviceId);

              const cancelNotice = {
                action: 'video:cancel',
                transferId: parsed.transferId,
                reason: parsed.reason || 'Transfer cancelled by user',
              };

              if (senderConn && senderConn.ws.readyState === WebSocket.OPEN) {
                this.safeSend(senderConn.ws, cancelNotice);
              }
              if (receiverConn && receiverConn.ws.readyState === WebSocket.OPEN) {
                this.safeSend(receiverConn.ws, cancelNotice);
              }
              break;
            }

            default:
              this.safeSend(ws, {
                action: 'error',
                code: 'UNKNOWN_ACTION',
                message: `Unknown action: ${action}`,
              });
          }
        } catch (err: any) {
          console.error('[WS] Failed to handle message:', err?.message || err);
          this.safeSend(ws, {
            action: 'error',
            code: 'BAD_REQUEST',
            message: err.message || 'Malformed message format',
          });
        }
      };

      // Handle messages from a connection strictly in order. Several handlers
      // await DB writes (video:start registers the transfer before any chunk may
      // be routed); without serialising, a following video:chunk could be
      // processed first and rejected with "Transfer not found".
      let messageQueue: Promise<void> = Promise.resolve();
      ws.on('message', (data: Buffer | string) => {
        // Record liveness before queueing: on a congested link the queue can take
        // a while to drain and the heartbeat must not mistake that for a dead
        // socket and kill a transfer that is still making progress.
        if (clientDeviceId) {
          const conn = this.clients.get(clientDeviceId);
          if (conn) conn.lastActivityAt = Date.now();
        }
        messageQueue = messageQueue.then(() => processMessage(data));
      });

      ws.on('close', () => {
        if (clientDeviceId) {
          this.handleDisconnect(clientDeviceId);
        }
      });

      ws.on('error', (err) => {
        console.error('WebSocket connection error:', err);
      });
    });

    // Heartbeat. Ping every 30 s to spot genuinely dead sockets, but never tear
    // down a connection that has delivered a frame recently: a phone pushing a
    // multi-gigabyte transfer over 2G can easily take longer than one ping
    // interval to return the pong, and killing it there aborts a healthy
    // transfer. Only a connection that is both unanswered *and* completely silent
    // for two minutes is considered dead.
    const HEARTBEAT_INTERVAL_MS = 30000;
    const HEARTBEAT_DEAD_MS = 120000;

    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      for (const [deviceId, conn] of this.clients.entries()) {
        if (!conn.isAlive) {
          if (now - conn.lastActivityAt < HEARTBEAT_DEAD_MS) {
            // Still sending data — the pong is simply in transit.
            conn.isAlive = true;
            continue;
          }
          conn.ws.terminate();
          this.handleDisconnect(deviceId);
          continue;
        }
        conn.isAlive = false;
        conn.ws.ping();
      }
    }, 30000);
  }

  /**
   * Resolve a transfer's routing info. Checks the in-memory cache first (the
   * common case for every chunk) and only falls back to MongoDB on a miss.
   * Database failures are swallowed so callers get a clean `null` instead of a
   * generic protocol error.
   */
  private async resolveTransfer(
    transferId: string
  ): Promise<{ senderDeviceId: string; receiverDeviceId: string } | null> {
    const cached = this.transferRoutes.get(transferId);
    if (cached) return cached;

    try {
      const transfer = await TransferService.getTransfer(transferId);
      if (!transfer) return null;

      const route = {
        senderDeviceId: transfer.senderDeviceId,
        receiverDeviceId: transfer.receiverDeviceId,
      };
      this.transferRoutes.set(transferId, route);
      return route;
    } catch (err: any) {
      console.warn(`[WS] Transfer lookup failed for ${transferId}:`, err?.message || err);
      return null;
    }
  }

  private registerClient(ws: WebSocket, deviceId: string) {
    this.clients.set(deviceId, {
      ws,
      deviceId,
      isAlive: true,
      lastActivityAt: Date.now(),
    });
  }

  private associateSession(deviceId: string, sessionId: string) {
    const client = this.clients.get(deviceId);
    if (client) {
      client.sessionId = sessionId;
    }
    if (!this.sessionClients.has(sessionId)) {
      this.sessionClients.set(sessionId, new Set());
    }
    this.sessionClients.get(sessionId)!.add(deviceId);
  }

  private handleDisconnect(deviceId: string) {
    const client = this.clients.get(deviceId);
    if (!client) return;

    const sessionId = client.sessionId;
    this.clients.delete(deviceId);

    if (sessionId && this.sessionClients.has(sessionId)) {
      const set = this.sessionClients.get(sessionId)!;
      set.delete(deviceId);
      if (set.size === 0) {
        this.sessionClients.delete(sessionId);
      }

      // Notify peer that this device went offline
      for (const otherDeviceId of set) {
        const otherConn = this.clients.get(otherDeviceId);
        if (otherConn && otherConn.ws.readyState === WebSocket.OPEN) {
          this.safeSend(otherConn.ws, {
            action: 'peer:status',
            status: 'offline',
            peerDeviceId: deviceId,
          });
        }
      }
    }
  }

  private async deliverPendingMessages(sessionId: string, receiverDeviceId: string, ws: WebSocket) {
    try {
      const pending = await MessageService.getPendingMessages(sessionId, receiverDeviceId);
      if (pending.length > 0) {
        for (const msg of pending) {
          this.safeSend(ws, {
            action: 'message:new',
            messageId: msg.messageId,
            sessionId: msg.sessionId,
            senderDeviceId: msg.senderDeviceId,
            receiverDeviceId: msg.receiverDeviceId,
            type: 'text',
            text: msg.text,
            timestamp: msg.timestamp,
            status: 'DELIVERED',
          });

          await MessageService.updateStatus(msg.messageId, 'DELIVERED');

          // Notify sender that queued message is now delivered
          const senderConn = this.clients.get(msg.senderDeviceId);
          if (senderConn && senderConn.ws.readyState === WebSocket.OPEN) {
            this.safeSend(senderConn.ws, {
              action: 'message:delivered',
              messageId: msg.messageId,
              deliveredTo: receiverDeviceId,
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed to deliver pending messages:', err);
    }
  }

  private safeSend(ws: WebSocket, payload: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  public close() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.wss.close();
  }
}
