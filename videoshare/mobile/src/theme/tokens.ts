import { Platform, TextStyle, ViewStyle } from 'react-native';

/** 4-point spacing scale. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

/** Generous corner radii — the hallmark of the modern "liquid" look. */
export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  xxl: 34,
  pill: 999,
} as const;

/** Slightly thicker than a device hairline so glass edges stay visible. */
export const hairlineWidth = Platform.OS === 'android' ? 0.8 : 0.6;

/**
 * Tint a theme colour that has no precomputed soft variant.
 *
 * The themes hand-write `accentSoft` / `dangerSoft`-style strings, but tinted
 * surfaces are occasionally needed for one-off states (a confirmed copy, a
 * verified transfer) where adding a token to all four themes would be noise.
 * Non-hex inputs are returned untouched so `rgba(...)` tokens pass through.
 */
export function withAlpha(color: string, alpha: number): string {
  const hex = color.startsWith('#') ? color.slice(1) : color;
  if (!/^[0-9a-f]{6}$/i.test(hex)) return color;
  const n = parseInt(hex, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export const typography: Record<string, TextStyle> = {
  /** Oversized hero headline. */
  display: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  /** Screen headline. */
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  /** Card / section headline. */
  heading: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  subheading: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  bodySmall: {
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: '400',
  },
  /** Uppercase eyebrow labels. */
  overline: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  caption: {
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '500',
  },
  /** Large numerics: progress %, timers, byte counters. */
  numeric: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 12,
    lineHeight: 17,
  },
};

/**
 * Soft, layered elevation. Android only honours `elevation`, so the two
 * platforms get tuned values rather than one compromise.
 */
export function elevation(
  level: 0 | 1 | 2 | 3,
  color: string = '#000000'
): ViewStyle {
  if (level === 0) return {};
  const config = {
    1: { radius: 12, opacity: 0.16, offset: 4, android: 3 },
    2: { radius: 24, opacity: 0.24, offset: 10, android: 8 },
    3: { radius: 40, opacity: 0.34, offset: 18, android: 16 },
  }[level];

  return Platform.OS === 'android'
    ? { elevation: config.android }
    : {
        shadowColor: color,
        shadowOpacity: config.opacity,
        shadowRadius: config.radius,
        shadowOffset: { width: 0, height: config.offset },
      };
}

/** Glow used behind primary CTAs and active transfer cards. */
export function glow(color: string, level: 1 | 2 = 1): ViewStyle {
  if (Platform.OS === 'android') {
    return { elevation: level === 1 ? 6 : 12 };
  }
  return {
    shadowColor: color,
    shadowOpacity: level === 1 ? 0.45 : 0.65,
    shadowRadius: level === 1 ? 16 : 26,
    shadowOffset: { width: 0, height: level === 1 ? 6 : 10 },
  };
}

export const layout = {
  screenPadding: spacing.xl,
  /** Max width so tablets do not stretch the layout into a thin column. */
  maxContentWidth: 560,
} as const;
