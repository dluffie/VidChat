import * as FileSystem from 'expo-file-system/legacy';

/**
 * Tiny JSON preference store.
 *
 * Deliberately backed by the app's documents directory rather than a native
 * key-value module: it needs no extra dependency, survives restarts, and the
 * payload (a theme id and a couple of flags) is far below any size worth
 * optimising for.
 */

const DIR = `${FileSystem.documentDirectory ?? ''}Convey/`;
const FILE = `${DIR}prefs.json`;

export interface Prefs {
  themeId?: string;
  chunkSize?: number;
  connectionProfile?: string;
}

export async function readPrefs(): Promise<Prefs> {
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return {};
    const raw = await FileSystem.readAsStringAsync(FILE);
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Prefs) : {};
  } catch {
    return {};
  }
}

export async function writePrefs(patch: Prefs): Promise<void> {
  try {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  } catch {
    // already exists
  }
  try {
    const current = await readPrefs();
    await FileSystem.writeAsStringAsync(FILE, JSON.stringify({ ...current, ...patch }));
  } catch {
    // Preference persistence is best-effort; the app still works in-memory.
  }
}
