import { z } from 'zod';

export const PairCreateSchema = z.object({
  action: z.literal('pair:create'),
  deviceId: z.string().min(1),
});

export const StorageInfoSchema = z.object({
  action: z.literal('storage:info'),
  sessionId: z.string().uuid(),
  senderDeviceId: z.string().min(1),
  storage: z.object({
    freeBytes: z.number().nonnegative(),
    totalBytes: z.number().nonnegative().optional(),
    freeFormatted: z.string().min(1),
    totalFormatted: z.string().min(1).optional(),
  }),
});

export const PairJoinSchema = z.object({
  action: z.literal('pair:join'),
  deviceId: z.string().min(1),
  pairingCode: z.string().length(6),
  storage: z.object({
    freeBytes: z.number().nonnegative(),
    totalBytes: z.number().nonnegative().optional(),
    freeFormatted: z.string().min(1),
    totalFormatted: z.string().min(1).optional(),
  }).optional(),
});

export const AuthSchema = z.object({
  action: z.literal('auth'),
  sessionId: z.string().uuid(),
  sessionToken: z.string().min(10),
  deviceId: z.string().min(1),
});

export const MessageSendSchema = z.object({
  action: z.literal('message:send'),
  messageId: z.string().min(1),
  sessionId: z.string().uuid(),
  senderDeviceId: z.string().min(1),
  receiverDeviceId: z.string().min(1).optional(),
  type: z.literal('text'),
  text: z.string().min(1).max(50000),
  timestamp: z.union([z.number(), z.string(), z.date()]).optional(),
});

export const MessageReadSchema = z.object({
  action: z.literal('message:read'),
  sessionId: z.string().uuid(),
  deviceId: z.string().min(1),
  messageIds: z.array(z.string()).optional(),
});

export const VideoStartSchema = z.object({
  action: z.literal('video:start'),
  transferId: z.string().min(1),
  sessionId: z.string().uuid(),
  senderDeviceId: z.string().min(1),
  receiverDeviceId: z.string().min(1).optional(),
  fileName: z.string().min(1),
  fileSize: z.number().positive(),
  mimeType: z.string().default('video/mp4'),
  totalChunks: z.number().int().positive(),
  chunkSize: z.number().int().positive(),
  encoding: z.literal('base64').default('base64'),
  checksum: z.string().length(64), // SHA-256 hex length
});

export const VideoChunkSchema = z.object({
  action: z.literal('video:chunk'),
  transferId: z.string().min(1),
  chunkIndex: z.number().int().nonnegative(),
  totalChunks: z.number().int().positive(),
  data: z.string().min(1),
  hash: z.string().length(64), // SHA-256 hex
});

export const VideoAckSchema = z.object({
  action: z.literal('video:ack'),
  transferId: z.string().min(1),
  chunkIndex: z.number().int().nonnegative(),
  status: z.literal('received'),
});

export const VideoRequestMissingSchema = z.object({
  action: z.literal('video:request_missing'),
  transferId: z.string().min(1),
  missingIndices: z.array(z.number().int().nonnegative()),
});

export const VideoCompleteSchema = z.object({
  action: z.literal('video:complete'),
  transferId: z.string().min(1),
  checksumVerified: z.boolean(),
});

export const VideoCancelSchema = z.object({
  action: z.literal('video:cancel'),
  transferId: z.string().min(1),
  reason: z.string().optional(),
});

export const PingSchema = z.object({
  action: z.literal('ping'),
});
