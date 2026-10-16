/**
 * Theme contract.
 *
 * Every screen and component consumes a `Theme` object obtained from
 * `useTheme()`, so the entire app can be re-skinned at runtime without a
 * single hard-coded colour anywhere in the UI layer.
 */

export type ThemeId = 'system' | 'aurora-dark' | 'aurora-light' | 'claude-warm' | 'midnight';

export type ThemeMode = 'dark' | 'light';

/** A concrete, resolvable theme (never `system`). */
export type ResolvedThemeId = Exclude<ThemeId, 'system'>;

export interface ThemeColors {
  /** Solid fallback behind the gradient. */
  background: string;
  /** Vertical canvas gradient, top to bottom. */
  gradient: [string, string, string];

  /** Three soft light blooms painted over the canvas for the "aurora" depth. */
  auroraA: string;
  auroraB: string;
  auroraC: string;
  /** 0-1 multiplier applied to the aurora blooms. */
  auroraOpacity: number;

  /** Frosted glass panel fill. */
  surface: string;
  /** Slightly brighter glass, for raised/active elements. */
  surfaceElevated: string;
  /** Hairline border that reads as the edge of a pane of glass. */
  surfaceBorder: string;
  /** Top-edge specular highlight. */
  surfaceHighlight: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  /** Primary brand accent (solid usage: icons, links, active states). */
  accent: string;
  /** Secondary accent, generally used as the far end of a gradient. */
  accentAlt: string;
  /** Two-stop gradient for primary CTAs and progress fills. */
  accentGradient: [string, string];
  /** Text/icon colour that sits on top of `accent` or `accentGradient`. */
  onAccent: string;
  /** Translucent accent wash for selected states. */
  accentSoft: string;

  /** Claude-style warm accent, used for secondary highlights. */
  warm: string;

  success: string;
  warning: string;
  danger: string;
  info: string;

  inputBg: string;
  inputBorder: string;

  /** Modal backdrop. */
  scrim: string;
  shadowColor: string;
  divider: string;

  /** Chat bubble fills. */
  bubbleOut: string;
  bubbleIn: string;
  /** Chat bubble borders. */
  bubbleOutBorder: string;
  bubbleInBorder: string;
}

export interface Theme {
  id: ResolvedThemeId;
  /** Human label shown in the theme picker. */
  name: string;
  /** One-line description for the theme picker. */
  description: string;
  mode: ThemeMode;
  /** Swatch colours used to preview the theme in the picker. */
  swatch: [string, string, string];
  colors: ThemeColors;
}

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  description: string;
  mode: ThemeMode | 'auto';
  swatch: [string, string, string];
}
