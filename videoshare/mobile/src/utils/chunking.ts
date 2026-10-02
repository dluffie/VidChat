// Configurable binary chunk sizes
export const CHUNK_SIZES = {
  CHUNK_32KB: 32 * 1024,
  CHUNK_64KB: 64 * 1024,   // Default recommended
  CHUNK_128KB: 128 * 1024, // High-throughput option
  CHUNK_256KB: 256 * 1024,
} as const;

export const DEFAULT_CHUNK_SIZE = CHUNK_SIZES.CHUNK_64KB;

export function calculateTotalChunks(fileSize: number, chunkSize: number = DEFAULT_CHUNK_SIZE): number {
  return Math.ceil(fileSize / chunkSize);
}

export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '0 KB/s';
  return `${formatBytes(bytesPerSec, 1)}/s`;
}

export function formatEta(seconds: number): string {
  if (seconds <= 0 || !isFinite(seconds)) return 'Calculating...';
  if (seconds < 60) return `ETA: ${Math.round(seconds)} sec`;
  const mins = Math.floor(seconds / 60);
  const remainingSecs = Math.round(seconds % 60);
  return `ETA: ${mins}m ${remainingSecs}s`;
}

/**
 * Identify missing chunk indexes given an array of received chunk indexes and total chunks
 */
export function findMissingChunks(receivedChunks: number[], totalChunks: number): number[] {
  const receivedSet = new Set(receivedChunks);
  const missing: number[] = [];
  for (let i = 0; i < totalChunks; i++) {
    if (!receivedSet.has(i)) {
      missing.push(i);
    }
  }
  return missing;
}
