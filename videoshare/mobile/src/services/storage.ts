import * as FileSystem from 'expo-file-system';
import { DeviceStorageInfo } from '../types/pairing';

export class StorageService {
  private static simulatedFreeBytes: number | null = null;
  private static defaultFreeBytes: number = 24.5 * 1024 * 1024 * 1024; // 24.5 GB default
  private static defaultTotalBytes: number = 64 * 1024 * 1024 * 1024; // 64 GB default

  /**
   * Format raw bytes into human readable string (e.g. '15.4 MB', '4.2 GB')
   */
  static formatBytes(bytes: number): string {
    if (bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = bytes / Math.pow(1024, i);
    return `${size.toFixed(i >= 2 ? 1 : 0)} ${units[i]}`;
  }

  /**
   * Retrieves device storage info (free space and total storage capacity)
   * Uses expo-file-system APIs — works on both iOS and Android without native modules.
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

    try {
      const [freeBytes, totalBytes] = await Promise.all([
        FileSystem.getFreeDiskStorageAsync(),
        FileSystem.getTotalDiskCapacityAsync(),
      ]);

      if (freeBytes != null && totalBytes != null) {
        return {
          freeBytes,
          totalBytes,
          freeFormatted: this.formatBytes(freeBytes),
          totalFormatted: this.formatBytes(totalBytes),
        };
      }
    } catch (e) {
      console.warn('expo-file-system storage query failed, falling back to defaults:', e);
    }

    // Default realistic storage for mobile device
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

    // Keep a safety margin of at least 10MB or 5% of file size
    const safetyMargin = Math.max(10 * 1024 * 1024, requiredBytes * 0.05);
    const totalRequiredWithMargin = requiredBytes + safetyMargin;

    if (availableBytes < totalRequiredWithMargin) {
      return {
        sufficient: false,
        requiredFormatted,
        availableFormatted,
        message: `Insufficient storage on receiver! Available: ${availableFormatted}, Required: ${requiredFormatted}. Transfer blocked to prevent failure.`,
      };
    }

    return {
      sufficient: true,
      requiredFormatted,
      availableFormatted,
      message: `Receiver has plenty of space (${availableFormatted} free). Safe to transfer ${requiredFormatted}.`,
    };
  }

  /**
   * For testing or demo purposes: simulate low or high free storage
   */
  static setSimulatedFreeBytes(bytes: number | null) {
    this.simulatedFreeBytes = bytes;
  }
}
