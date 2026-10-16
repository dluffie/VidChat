/**
 * Binary <-> Base64 text-safe encoding.
 *
 * Note: Base64 expands binary data by ~33.3% (4 output chars for every 3 input
 * bytes). It is NOT compression.
 */

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Char codes of the alphabet, so the encoder never has to build intermediate strings.
const B64_CODES = (() => {
  const codes = new Uint8Array(64);
  for (let i = 0; i < 64; i++) codes[i] = BASE64_CHARS.charCodeAt(i);
  return codes;
})();

// Reverse lookup for decoding.
const B64_DECODE = (() => {
  const table = new Int16Array(256).fill(-1);
  for (let i = 0; i < 64; i++) table[BASE64_CHARS.charCodeAt(i)] = i;
  return table;
})();

// Number of output characters flushed to `String.fromCharCode` at a time.
// Must be a multiple of 4 (each group of 3 input bytes emits 4 chars) and stays
// well below the argument limit that `Function.prototype.apply` tolerates.
const ENCODE_BATCH = 4096;
const encodeBuffer: number[] = new Array(ENCODE_BATCH);

/**
 * Encodes bytes to base64.
 *
 * Built for large payloads: output characters are accumulated into a reusable
 * code buffer and flushed through `String.fromCharCode` in batches, which avoids
 * hundreds of thousands of single-character string concatenations.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const len = bytes.byteLength;
  if (len === 0) return '';

  const mainLength = len - (len % 3);
  let result = '';
  let ci = 0;

  for (let i = 0; i < mainLength; i += 3) {
    const c = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    encodeBuffer[ci++] = B64_CODES[(c >>> 18) & 63];
    encodeBuffer[ci++] = B64_CODES[(c >>> 12) & 63];
    encodeBuffer[ci++] = B64_CODES[(c >>> 6) & 63];
    encodeBuffer[ci++] = B64_CODES[c & 63];

    if (ci === ENCODE_BATCH) {
      result += String.fromCharCode.apply(null, encodeBuffer);
      ci = 0;
    }
  }

  // Padding for the trailing 1 or 2 bytes.
  const extraBytes = len - mainLength;
  if (extraBytes === 1) {
    const c = bytes[mainLength];
    encodeBuffer[ci++] = B64_CODES[(c >>> 2) & 63];
    encodeBuffer[ci++] = B64_CODES[(c & 3) << 4];
    encodeBuffer[ci++] = 61; // '='
    encodeBuffer[ci++] = 61;
  } else if (extraBytes === 2) {
    const c = (bytes[mainLength] << 8) | bytes[mainLength + 1];
    encodeBuffer[ci++] = B64_CODES[(c >>> 10) & 63];
    encodeBuffer[ci++] = B64_CODES[(c >>> 4) & 63];
    encodeBuffer[ci++] = B64_CODES[(c & 15) << 2];
    encodeBuffer[ci++] = 61; // '='
  }

  if (ci > 0) {
    result += String.fromCharCode.apply(null, ci === ENCODE_BATCH ? encodeBuffer : encodeBuffer.slice(0, ci));
  }
  return result;
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const cleanBase64 = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = cleanBase64.length;
  const byteLength = Math.floor((len * 3) / 4);
  const bytes = new Uint8Array(byteLength);

  let p = 0;
  let i = 0;
  for (; i + 4 <= len; i += 4) {
    const e1 = B64_DECODE[cleanBase64.charCodeAt(i)];
    const e2 = B64_DECODE[cleanBase64.charCodeAt(i + 1)];
    const e3 = B64_DECODE[cleanBase64.charCodeAt(i + 2)];
    const e4 = B64_DECODE[cleanBase64.charCodeAt(i + 3)];

    if (e1 >= 0 && e2 >= 0) bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (e3 >= 0 && p < byteLength) bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (e4 >= 0 && p < byteLength) bytes[p++] = ((e3 & 3) << 6) | (e4 & 63);
  }

  // Trailing group without padding characters.
  const remaining = cleanBase64.length - i;
  if (remaining >= 2 && p < byteLength) {
    const e1 = B64_DECODE[cleanBase64.charCodeAt(i)];
    const e2 = B64_DECODE[cleanBase64.charCodeAt(i + 1)];
    const e3 = remaining > 2 ? B64_DECODE[cleanBase64.charCodeAt(i + 2)] : -1;
    if (e1 >= 0 && e2 >= 0) bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (e3 >= 0 && p < byteLength) bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
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
