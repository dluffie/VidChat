import CryptoJS from 'crypto-js';

/**
 * Calculates SHA-256 hash of a string or byte array
 */
export function calculateSHA256(data: string | Uint8Array): string {
  if (typeof data === 'string') {
    return CryptoJS.SHA256(data).toString(CryptoJS.enc.Hex);
  }

  // Convert Uint8Array to CryptoJS WordArray
  const words: number[] = [];
  const len = data.length;
  for (let i = 0; i < len; i += 4) {
    const word =
      ((data[i] || 0) << 24) |
      ((data[i + 1] || 0) << 16) |
      ((data[i + 2] || 0) << 8) |
      (data[i + 3] || 0);
    words.push(word);
  }

  const wordArray = CryptoJS.lib.WordArray.create(words, len);
  return CryptoJS.SHA256(wordArray).toString(CryptoJS.enc.Hex);
}

/**
 * Verifies if calculated hash matches expected checksum
 */
export function verifyChecksum(expected: string, actual: string): boolean {
  return expected.trim().toLowerCase() === actual.trim().toLowerCase();
}
