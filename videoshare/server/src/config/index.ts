import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: '0.0.0.0',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/videoshare',
  sessionSecret: process.env.SESSION_SECRET || 'videoshare-insecure-dev-secret-key-change-in-prod',
  nodeEnv: process.env.NODE_ENV || 'development',
  pairingExpiryMinutes: parseInt(process.env.PAIRING_EXPIRY_MINUTES || '10', 10),
  maxChunkSizeBytes: parseInt(process.env.MAX_CHUNK_SIZE_BYTES || '262144', 10), // 256 KB max encoded chunk
  defaultBinaryChunkSize: 65536, // 64 KB binary chunk default
};
