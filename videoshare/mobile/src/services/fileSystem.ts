import * as FileSystem from 'expo-file-system/legacy';
import { base64ToUint8Array, uint8ArrayToBase64 } from '../utils/encoding';
import { calculateSHA256 } from './hashing';

// In-memory or filesystem storage abstraction
const assembledFiles = new Map<string, Uint8Array>(); // filePath -> binaryData

export class FileSystemService {
  private static get basePath(): string {
    const docDir = FileSystem.documentDirectory || '';
    return docDir.endsWith('/') ? `${docDir}VideoShare/transfers/` : `${docDir}/VideoShare/transfers/`;
  }

  private static get downloadPath(): string {
    const docDir = FileSystem.documentDirectory || '';
    return docDir.endsWith('/') ? `${docDir}VideoShare/downloads/` : `${docDir}/VideoShare/downloads/`;
  }

  private static getTransferDir(transferId: string): string {
    const base = this.basePath;
    return base.endsWith('/') ? `${base}${transferId}` : `${base}/${transferId}`;
  }

  /**
   * Initializes the temporary directory for incoming video chunks
   * e.g. /VideoShare/transfers/{transferId}/
   */
  static async initTransferDirectory(transferId: string): Promise<string> {
    const dir = this.getTransferDir(transferId);
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
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
    const dir = this.getTransferDir(transferId);
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    const padded = String(chunkIndex).padStart(6, '0');
    const chunkPath = `${dir}/chunk_${padded}`;
    await FileSystem.writeAsStringAsync(chunkPath, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  /**
   * Reads a single saved chunk
   */
  static async readChunk(transferId: string, chunkIndex: number): Promise<string | null> {
    const padded = String(chunkIndex).padStart(6, '0');
    const chunkPath = `${this.getTransferDir(transferId)}/chunk_${padded}`;
    try {
      const info = await FileSystem.getInfoAsync(chunkPath);
      if (!info.exists) return null;
      return await FileSystem.readAsStringAsync(chunkPath, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch {
      return null;
    }
  }

  /**
   * Returns a list of chunk indices that have been successfully saved for this transfer
   */
  static async getSavedChunkIndices(transferId: string): Promise<number[]> {
    const dir = this.getTransferDir(transferId);
    try {
      const info = await FileSystem.getInfoAsync(dir);
      if (!info.exists) return [];
      const files = await FileSystem.readDirectoryAsync(dir);
      const indices: number[] = [];
      for (const file of files) {
        const match = file.match(/^chunk_(\d+)$/);
        if (match) {
          indices.push(parseInt(match[1], 10));
        }
      }
      return indices.sort((a, b) => a - b);
    } catch {
      return [];
    }
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
    const dir = this.getTransferDir(transferId);
    const savedIndices = await this.getSavedChunkIndices(transferId);
    if (savedIndices.length !== totalChunks) {
      throw new Error(`Cannot reassemble: expected ${totalChunks} chunks, found ${savedIndices.length}`);
    }

    // Determine total byte length by summing individual decoded chunks
    const decodedChunks: Uint8Array[] = [];
    let totalBytes = 0;

    for (let i = 0; i < totalChunks; i++) {
      const padded = String(i).padStart(6, '0');
      const chunkPath = `${dir}/chunk_${padded}`;
      const b64 = await FileSystem.readAsStringAsync(chunkPath, {
        encoding: FileSystem.EncodingType.Base64,
      });
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

    const downloadDir = this.downloadPath;
    const downloadDirInfo = await FileSystem.getInfoAsync(downloadDir);
    if (!downloadDirInfo.exists) {
      await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
    }

    const destPath = `${downloadDir}${fileName}`;
    const base64Video = uint8ArrayToBase64(finalVideo);
    await FileSystem.writeAsStringAsync(destPath, base64Video, {
      encoding: FileSystem.EncodingType.Base64,
    });

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
    const dir = this.getTransferDir(transferId);
    try {
      const info = await FileSystem.getInfoAsync(dir);
      if (info.exists) {
        await FileSystem.deleteAsync(dir, { idempotent: true });
      }
    } catch (err) {
      console.warn(`[FileSystemService] Failed to cleanup transfer chunks:`, err);
    }
  }

  /**
   * Gets reconstructed file bytes for playback or export
   */
  static async getFile(filePath: string): Promise<Uint8Array | null> {
    try {
      const info = await FileSystem.getInfoAsync(filePath);
      if (info.exists) {
        const b64 = await FileSystem.readAsStringAsync(filePath, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return base64ToUint8Array(b64);
      }
    } catch {
      // Fallback
    }
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
