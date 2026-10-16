import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import { readPrefs, writePrefs } from '../services/prefs';
import { DEFAULT_THEME_ID, SYSTEM_THEME_BY_MODE, THEMES, THEME_LIST } from './themes';
import { ResolvedThemeId, Theme, ThemeId, ThemeMeta } from './types';

interface ThemeContextValue {
  /** The active, fully resolved theme. */
  theme: Theme;
  /** The user's selection, which may be `system`. */
  themeId: ThemeId;
  /** The concrete theme currently rendering (never `system`). */
  resolvedId: ResolvedThemeId;
  themes: ThemeMeta[];
  isDark: boolean;
  setThemeId: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const VALID_IDS: ThemeId[] = ['system', 'aurora-dark', 'aurora-light', 'claude-warm', 'midnight'];

function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (VALID_IDS as string[]).includes(value);
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME_ID);

  // Restore the saved choice once, on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const prefs = await readPrefs();
      if (!cancelled && isThemeId(prefs.themeId)) {
        setThemeIdState(prefs.themeId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    void writePrefs({ themeId: id });
  }, []);

  const resolvedId: ResolvedThemeId =
    themeId === 'system'
      ? SYSTEM_THEME_BY_MODE[systemScheme === 'light' ? 'light' : 'dark']
      : themeId;

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: THEMES[resolvedId],
      themeId,
      resolvedId,
      themes: THEME_LIST,
      isDark: THEMES[resolvedId].mode === 'dark',
      setThemeId,
    }),
    [resolvedId, themeId, setThemeId]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme() must be used inside <ThemeProvider>');
  }
  return ctx;
}
