import { base64ToUint8Array, uint8ArrayToBase64 } from '../utils/encoding.js';
import { calculateSHA256 } from './hashing.js';

// In-memory or filesystem storage abstraction
const chunkStorage = new Map<string, Map<number, string>>(); // transferId -> (chunkIndex -> base64Data)
const assembledFiles = new Map<string, Uint8Array>(); // filePath -> binaryData

export class FileSystemService {
  private static basePath = '/VideoShare/transfers';
  private static downloadPath = '/VideoShare/downloads';

  /**
   * Initializes the temporary directory for incoming video chunks
   * e.g. /VideoShare/transfers/{transferId}/
   */
  static async initTransferDirectory(transferId: string): Promise<string> {
    const dir = `${this.basePath}/${transferId}`;
    if (!chunkStorage.has(transferId)) {
      chunkStorage.set(transferId, new Map());
    }
    return dir;
  }

  /**
   * Writes a chunk text payload to local device storage
   * chunk filename format: chunk_000001
   */
  static async writeChunk(
    transferId: string,
    chunkIndex: number,
    base64Data: string
  ): Promise<void> {
    if (!chunkStorage.has(transferId)) {
      chunkStorage.set(transferId, new Map());
    }
    const chunks = chunkStorage.get(transferId)!;
    chunks.set(chunkIndex, base64Data);
  }

  /**
   * Reads a single saved chunk
   */
  static async readChunk(transferId: string, chunkIndex: number): Promise<string | null> {
    const chunks = chunkStorage.get(transferId);
    if (!chunks) return null;
    return chunks.get(chunkIndex) || null;
  }

  /**
   * Returns a list of chunk indices that have been successfully saved for this transfer
   */
  static async getSavedChunkIndices(transferId: string): Promise<number[]> {
    const chunks = chunkStorage.get(transferId);
    if (!chunks) return [];
    return Array.from(chunks.keys()).sort((a, b) => a - b);
  }

  /**
   * Reassembles all saved chunks into the destination video file
   * Then computes and returns the reconstructed file's SHA-256 hash
   */
  static async reassembleVideo(
    transferId: string,
    fileName: string,
    totalChunks: number
  ): Promise<{ filePath: string; reconstructedHash: string; byteLength: number }> {
    const chunks = chunkStorage.get(transferId);
    if (!chunks || chunks.size !== totalChunks) {
      throw new Error(`Cannot reassemble: expected ${totalChunks} chunks, found ${chunks?.size || 0}`);
    }

    // Determine total byte length by summing individual decoded chunks
    const decodedChunks: Uint8Array[] = [];
    let totalBytes = 0;

    for (let i = 0; i < totalChunks; i++) {
      const b64 = chunks.get(i);
      if (!b64) {
        throw new Error(`Missing chunk #${i} during reassembly`);
      }
      const binaryChunk = base64ToUint8Array(b64);
      decodedChunks.push(binaryChunk);
      totalBytes += binaryChunk.byteLength;
    }

    // Allocate unified byte array for the full video
    const finalVideo = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of decodedChunks) {
      finalVideo.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const reconstructedHash = calculateSHA256(finalVideo);
    const destPath = `${this.downloadPath}/${fileName}`;

    assembledFiles.set(destPath, finalVideo);

    return {
      filePath: destPath,
      reconstructedHash,
      byteLength: totalBytes,
    };
  }

  /**
   * Cleans up temporary chunk files after successful verification or cancellation
   */
  static async cleanupTransferChunks(transferId: string): Promise<void> {
    chunkStorage.delete(transferId);
  }

  /**
   * Gets reconstructed file bytes for playback or export
   */
  static async getFile(filePath: string): Promise<Uint8Array | null> {
    return assembledFiles.get(filePath) || null;
  }

  /**
   * Helper to create mock video file data for testing
   */
  static createMockVideo(fileName: string, sizeInBytes: number): { filePath: string; data: Uint8Array; checksum: string } {
    const data = new Uint8Array(sizeInBytes);
    // Fill with sample byte patterns
    for (let i = 0; i < sizeInBytes; i++) {
      data[i] = (i * 31 + 17) % 256;
    }
    const checksum = calculateSHA256(data);
    const filePath = `/storage/emulated/0/Movies/${fileName}`;
    assembledFiles.set(filePath, data);
    return { filePath, data, checksum };
  }
}
