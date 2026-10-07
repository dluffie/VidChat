/**
 * Maps old React Navigation screen names to expo-router pathnames.
 * Existing screens use capitalized names like 'Chat', 'Pair', 'Home', 'VideoTransfer'.
 */
export function toRoutePath(name: string): string {
  const map: Record<string, string> = {
    home: '/',
    pair: '/pair',
    chat: '/chat',
    videotransfer: '/videotransfer',
  };
  return map[name.toLowerCase()] ?? `/${name.toLowerCase()}`;
}
