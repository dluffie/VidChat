/**
 * High-performance binary <-> Base64 text-safe encoding
 * Note: Base64 expands binary data by ~33.3% (4 output chars for every 3 input bytes).
 * It is NOT compression.
 */

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let result = '';
  const len = bytes.byteLength;
  const extraBytes = len % 3; // 0, 1, or 2
  const mainLength = len - extraBytes;

  let a: number, b: number, c: number, d: number;
  let chunk: number;

  // Process 3 bytes at a time -> 4 base64 chars
  for (let i = 0; i < mainLength; i += 3) {
    chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    a = (chunk & 16515072) >> 18; // 111111000000000000000000
    b = (chunk & 258048) >> 12;   // 000000111111000000000000
    c = (chunk & 4032) >> 6;      // 000000000000111111000000
    d = chunk & 63;               // 000000000000000000111111

    result += BASE64_CHARS[a] + BASE64_CHARS[b] + BASE64_CHARS[c] + BASE64_CHARS[d];
  }

  // Handle padding for remaining bytes
  if (extraBytes === 1) {
    chunk = bytes[mainLength];
    a = (chunk & 252) >> 2;
    b = (chunk & 3) << 4;
    result += BASE64_CHARS[a] + BASE64_CHARS[b] + '==';
  } else if (extraBytes === 2) {
    chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1];
    a = (chunk & 64512) >> 10;
    b = (chunk & 1008) >> 4;
    c = (chunk & 15) << 2;
    result += BASE64_CHARS[a] + BASE64_CHARS[b] + BASE64_CHARS[c] + '=';
  }

  return result;
}

export function base64ToUint8Array(base64: string): Uint8Array {
  // Strip padding and whitespace
  const cleanBase64 = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = cleanBase64.length;
  const byteLength = Math.floor((len * 3) / 4);
  const bytes = new Uint8Array(byteLength);

  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const encoded1 = BASE64_CHARS.indexOf(cleanBase64[i]);
    const encoded2 = BASE64_CHARS.indexOf(cleanBase64[i + 1]);
    const encoded3 = BASE64_CHARS.indexOf(cleanBase64[i + 2]);
    const encoded4 = BASE64_CHARS.indexOf(cleanBase64[i + 3]);

    if (encoded1 !== -1 && encoded2 !== -1) {
      bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    }
    if (encoded3 !== -1 && p < byteLength) {
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    }
    if (encoded4 !== -1 && p < byteLength) {
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }
  }

  return bytes;
}

/**
 * Expected Base64 text size from original binary size
 */
export function calculateEncodedSize(binarySize: number): number {
  return Math.ceil(binarySize / 3) * 4;
}

/**
 * Ratio of encoded text payload vs original binary
 */
export function calculateOverheadRatio(binarySize: number, encodedSize: number): number {
  if (binarySize === 0) return 1;
  return Number((encodedSize / binarySize).toFixed(2));
}
