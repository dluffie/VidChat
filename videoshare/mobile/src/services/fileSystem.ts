import * as FileSystem from 'expo-file-system/legacy';
import { File, FileHandle, FileMode, Paths } from 'expo-file-system';
import { base64ToUint8Array } from '../utils/encoding';

const YIELD_EVERY_CHUNKS = 64;

export class FileSystemService {
  private static get basePath(): string {
    const docDir = FileSystem.documentDirectory || '';
    return docDir.endsWith('/') ? `${docDir}VideoShare/transfers/` : `${docDir}/VideoShare/transfers/`;
  }

  private static get downloadPath(): string {
    const docDir = FileSystem.documentDirectory || '';
    return docDir.endsWith('/') ? `${docDir}VideoShare/downloads/` : `${docDir}/VideoShare/downloads/`;
  }

  private static get stagingPath(): string {
    const cacheDir = FileSystem.cacheDirectory || '';
    return cacheDir.endsWith('/') ? `${cacheDir}VideoShare/` : `${cacheDir}/VideoShare/`;
  }

  private static getTransferDir(transferId: string): string {
    const base = this.basePath;
    return base.endsWith('/') ? `${base}${transferId}` : `${base}/${transferId}`;
  }

  static sanitizeFileName(fileName: string): string {
    const cleaned = fileName.replace(/[\\/:*?"<>|]/g, '_').replace(/^\.+/, '').trim();
    return cleaned.length > 0 ? cleaned : 'video.mp4';
  }

  private static async ensureDir(dir: string): Promise<void> {
    try {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    } catch {
      // Already exists — callers can race.
    }
  }

  /**
   * Free space on the device's internal storage, in bytes.
   * Reported by the native module instead of the deprecated async helpers.
   */
  static getAvailableDiskSpace(): number {
    try {
      return Paths.availableDiskSpace || 0;
    } catch {
      return 0;
    }
  }

  static getTotalDiskSpace(): number {
    try {
      return Paths.totalDiskSpace || 0;
    } catch {
      return 0;
    }
  }

  static async getFileSize(uri: string): Promise<number> {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists && 'size' in info && typeof (info as any).size === 'number') {
        return (info as any).size as number;
      }
    } catch {
      // fall through
    }
    try {
      return new File(uri).size;
    } catch {
      return 0;
    }
  }

  /**
   * Makes sure the file can be randomly accessed with a plain `file://` path.
   * Storage Access Framework `content://` URIs do not support seeking the way we
   * need, so those are copied into the app cache once.
   */
  static async ensureLocalFile(sourceUri: string, transferId: string): Promise<string> {
    if (sourceUri.startsWith('file://')) {
      return sourceUri;
    }

    await this.ensureDir(this.stagingPath);
    const dest = `${this.stagingPath}${transferId}-source`;
    await FileSystem.copyAsync({ from: sourceUri, to: dest });
    return dest;
  }

  /** Opens a read handle for slicing a file by byte range. */
  static openReadHandle(uri: string): FileHandle {
    return new File(uri).open(FileMode.ReadOnly);
  }

  static closeHandle(handle: FileHandle | undefined | null): void {
    if (!handle) return;
    try {
      handle.close();
    } catch {
      // already closed
    }
  }

  static async initTransferDirectory(transferId: string): Promise<string> {
    const dir = this.getTransferDir(transferId);
    await this.ensureDir(dir);
    return dir;
  }

  /**
   * Writes a chunk payload to local device storage.
   * Filename format: chunk_000001
   *
   * Uses the base64 encoding option so the native layer performs the decode.
   */
  static async writeChunk(
    transferId: string,
    chunkIndex: number,
    base64Data: string
  ): Promise<void> {
    const dir = this.getTransferDir(transferId);
    await this.ensureDir(dir);
    const padded = String(chunkIndex).padStart(6, '0');
    const chunkPath = `${dir}/chunk_${padded}`;
    await FileSystem.writeAsStringAsync(chunkPath, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

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
   * Returns the indices of chunks already persisted for this transfer.
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
   * Streams every saved chunk into the destination video file.
   *
   * Chunks are copied one at a time through a native file handle and deleted as
   * soon as they have been appended, so peak memory stays at a single chunk and
   * peak disk usage stays close to one copy of the video instead of two.
   */
  static async reassembleVideo(
    transferId: string,
    fileName: string,
    totalChunks: number,
    onProgress?: (copiedChunks: number, totalChunks: number) => void
  ): Promise<{ filePath: string; byteLength: number }> {
    const dir = this.getTransferDir(transferId);
    const downloadDir = this.downloadPath;
    await this.ensureDir(downloadDir);

    const destPath = `${downloadDir}${this.sanitizeFileName(fileName)}`;
    const dest = new File(destPath);

    try {
      dest.delete();
    } catch {
      // did not exist
    }
    dest.create({ intermediates: true, overwrite: true });

    const out = dest.open(FileMode.WriteOnly);
    let totalBytes = 0;

    try {
      for (let i = 0; i < totalChunks; i++) {
        const padded = String(i).padStart(6, '0');
        const chunkPath = `${dir}/chunk_${padded}`;
        const chunkFile = new File(chunkPath);

        let bytes: Uint8Array;
        try {
          bytes = chunkFile.bytesSync();
        } catch {
          throw new Error(`Missing chunk #${i} during reassembly`);
        }
        if (!bytes || bytes.length === 0) {
          throw new Error(`Missing chunk #${i} during reassembly`);
        }

        out.offset = totalBytes;
        out.writeBytes(bytes);
        totalBytes += bytes.length;

        // Reclaim space immediately.
        try {
          chunkFile.delete();
        } catch {
          // ignore
        }

        if (onProgress && i % 128 === 0) {
          onProgress(i + 1, totalChunks);
        }

        // Keep the UI thread breathing on long videos.
        if (i % YIELD_EVERY_CHUNKS === YIELD_EVERY_CHUNKS - 1) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
    } finally {
      this.closeHandle(out);
    }

    return { filePath: destPath, byteLength: totalBytes };
  }

  /**
   * Removes temporary chunk files after completion or cancellation.
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
   * Removes a staged copy made by `ensureLocalFile`.
   */
  static async cleanupStagedSource(transferId: string): Promise<void> {
    const staged = `${this.stagingPath}${transferId}-source`;
    try {
      await FileSystem.deleteAsync(staged, { idempotent: true });
    } catch {
      // ignore
    }
  }

  static async deleteFile(uri: string): Promise<void> {
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch {
      // ignore
    }
  }

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
      // fall through
    }
    return null;
  }

  /**
   * Writes a synthetic video to disk for the in-app "send a test video" flow.
   * Generated in small slices so an arbitrary size never allocates it all at once.
   */
  static async createMockVideoFile(fileName: string, sizeInBytes: number): Promise<string> {
    await this.ensureDir(this.stagingPath);
    const filePath = `${this.stagingPath}mock-${this.sanitizeFileName(fileName)}`;
    const file = new File(filePath);
    try {
      file.delete();
    } catch {
      // did not exist
    }
    file.create({ intermediates: true, overwrite: true });

    const handle = file.open(FileMode.WriteOnly);
    const SLICE = 64 * 1024;
    const slice = new Uint8Array(SLICE);

    try {
      let written = 0;
      while (written < sizeInBytes) {
        const length = Math.min(SLICE, sizeInBytes - written);
        for (let i = 0; i < length; i++) {
          slice[i] = (i * 31 + 17) % 256;
        }
        handle.offset = written;
        handle.writeBytes(length === SLICE ? slice : slice.subarray(0, length));
        written += length;

        if (written % (1024 * 1024) === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
    } finally {
      this.closeHandle(handle);
    }

    return filePath;
  }
}
