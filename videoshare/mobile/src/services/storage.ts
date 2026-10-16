import { DeviceStorageInfo } from '../types/pairing';
import { FileSystemService } from './fileSystem';

export class StorageService {
  private static simulatedFreeBytes: number | null = null;
  private static defaultFreeBytes: number = 24.5 * 1024 * 1024 * 1024; // 24.5 GB fallback
  private static defaultTotalBytes: number = 64 * 1024 * 1024 * 1024; // 64 GB fallback

  /**
   * Format raw bytes into human readable string (e.g. '15.4 MB', '4.2 GB')
   */
  static formatBytes(bytes: number): string {
    if (bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const size = bytes / Math.pow(1024, i);
    return `${size.toFixed(i >= 2 ? 1 : 0)} ${units[i]}`;
  }

  /**
   * Retrieves device storage info (free space and total capacity).
   *
   * Reads the values straight off the native file system module. The previous
   * implementation used deprecated async helpers that silently fell back to a
   * fabricated 24.5 GB, which made the pre-transfer storage check useless.
   */
  static async getStorageInfo(): Promise<DeviceStorageInfo> {
    if (this.simulatedFreeBytes !== null) {
      return {
        freeBytes: this.simulatedFreeBytes,
        totalBytes: this.defaultTotalBytes,
        freeFormatted: this.formatBytes(this.simulatedFreeBytes),
        totalFormatted: this.formatBytes(this.defaultTotalBytes),
      };
    }

    const freeBytes = FileSystemService.getAvailableDiskSpace();
    const totalBytes = FileSystemService.getTotalDiskSpace();

    if (freeBytes > 0) {
      return {
        freeBytes,
        totalBytes: totalBytes > 0 ? totalBytes : this.defaultTotalBytes,
        freeFormatted: this.formatBytes(freeBytes),
        totalFormatted: this.formatBytes(totalBytes > 0 ? totalBytes : this.defaultTotalBytes),
      };
    }

    console.warn('[StorageService] Native disk space unavailable, using fallback estimate');
    return {
      freeBytes: this.defaultFreeBytes,
      totalBytes: this.defaultTotalBytes,
      freeFormatted: this.formatBytes(this.defaultFreeBytes),
      totalFormatted: this.formatBytes(this.defaultTotalBytes),
    };
  }

  /**
   * Verifies if available storage can safely accommodate the requested video file size
   */
  static verifyStorage(
    requiredBytes: number,
    availableBytes: number
  ): {
    sufficient: boolean;
    requiredFormatted: string;
    availableFormatted: string;
    message: string;
  } {
    const requiredFormatted = this.formatBytes(requiredBytes);
    const availableFormatted = this.formatBytes(availableBytes);

    // Keep a safety margin of at least 50MB or 5% of file size
    const safetyMargin = Math.max(50 * 1024 * 1024, requiredBytes * 0.05);
    const totalRequiredWithMargin = requiredBytes + safetyMargin;

    if (availableBytes < totalRequiredWithMargin) {
      return {
        sufficient: false,
        requiredFormatted,
        availableFormatted,
        message: `Insufficient storage on receiver! Available: ${availableFormatted}, Required: ${requiredFormatted} (+ safety margin). Transfer blocked to prevent a mid-transfer failure.`,
      };
    }

    return {
      sufficient: true,
      requiredFormatted,
      availableFormatted,
      message: `Receiver has enough space (${availableFormatted} free). Safe to transfer ${requiredFormatted}.`,
    };
  }

  /**
   * For testing or demo purposes: simulate low or high free storage
   */
  static setSimulatedFreeBytes(bytes: number | null) {
    this.simulatedFreeBytes = bytes;
  }
}
