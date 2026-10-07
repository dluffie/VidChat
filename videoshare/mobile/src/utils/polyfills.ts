/**
 * Crypto polyfill for React Native / Hermes.
 *
 * uuid v9+ relies on `crypto.getRandomValues()` which is part of the Web Crypto
 * API and is NOT available in Hermes (React Native's JS engine) by default.
 *
 * expo-crypto ships `ExpoCrypto.getRandomValues()` as a native-backed
 * implementation. We attach it to `globalThis.crypto` here so any library
 * (uuid, nanoid, etc.) that calls `crypto.getRandomValues()` works correctly.
 *
 * This file MUST be imported before any module that calls uuidv4() / uuidv1().
 */
import * as ExpoCrypto from 'expo-crypto';

if (typeof globalThis.crypto === 'undefined') {
  // @ts-ignore – attach polyfill to global
  globalThis.crypto = {};
}

if (typeof globalThis.crypto.getRandomValues !== 'function') {
  // @ts-ignore
  globalThis.crypto.getRandomValues = (array: Uint8Array) => {
    // expo-crypto.getRandomValues fills the typed array in-place and returns it
    return ExpoCrypto.getRandomValues(array);
  };
}
