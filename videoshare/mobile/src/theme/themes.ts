import { Theme, ThemeMeta, ResolvedThemeId } from './types';

/**
 * Aurora Dark — deep near-black canvas lit by violet/cyan blooms, with
 * translucent glass panes and a warm secondary accent.
 */
const auroraDark: Theme = {
  id: 'aurora-dark',
  name: 'Aurora Dark',
  description: 'Liquid glass over a violet & cyan night',
  mode: 'dark',
  swatch: ['#0A0B18', '#7C6BFF', '#3FD0E0'],
  colors: {
    background: '#05060B',
    gradient: ['#0B0C1A', '#070812', '#04050A'],

    auroraA: '#6D5BFF',
    auroraB: '#1FB6D8',
    auroraC: '#FF7A59',
    auroraOpacity: 0.55,

    surface: 'rgba(255,255,255,0.055)',
    surfaceElevated: 'rgba(255,255,255,0.09)',
    surfaceBorder: 'rgba(255,255,255,0.10)',
    surfaceHighlight: 'rgba(255,255,255,0.17)',

    textPrimary: '#F4F6FB',
    textSecondary: 'rgba(244,246,251,0.66)',
    textMuted: 'rgba(244,246,251,0.40)',

    accent: '#8B7BFF',
    accentAlt: '#3FD0E0',
    accentGradient: ['#7C6BFF', '#3FD0E0'],
    onAccent: '#FFFFFF',
    accentSoft: 'rgba(124,107,255,0.16)',

    warm: '#FF8A66',

    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#FB7185',
    info: '#60A5FA',

    inputBg: 'rgba(255,255,255,0.05)',
    inputBorder: 'rgba(255,255,255,0.10)',

    scrim: 'rgba(3,4,10,0.74)',
    shadowColor: '#000000',
    divider: 'rgba(255,255,255,0.07)',

    bubbleOut: 'rgba(124,107,255,0.20)',
    bubbleIn: 'rgba(255,255,255,0.055)',
    bubbleOutBorder: 'rgba(140,125,255,0.34)',
    bubbleInBorder: 'rgba(255,255,255,0.08)',
  },
};

/**
 * Aurora Light — the same glass language on a cool paper white canvas.
 */
const auroraLight: Theme = {
  id: 'aurora-light',
  name: 'Aurora Light',
  description: 'Frosted glass on a soft daylight canvas',
  mode: 'light',
  swatch: ['#F7F8FC', '#6A5AE0', '#22B8CF'],
  colors: {
    background: '#F7F8FC',
    gradient: ['#FFFFFF', '#F4F6FD', '#EDF1FA'],

    auroraA: '#8B7BFF',
    auroraB: '#4FC3E8',
    auroraC: '#FFA987',
    auroraOpacity: 0.30,

    surface: 'rgba(255,255,255,0.72)',
    surfaceElevated: 'rgba(255,255,255,0.92)',
    surfaceBorder: 'rgba(15,23,42,0.07)',
    surfaceHighlight: 'rgba(255,255,255,0.95)',

    textPrimary: '#111827',
    textSecondary: 'rgba(17,24,39,0.62)',
    textMuted: 'rgba(17,24,39,0.42)',

    accent: '#5B4BDB',
    accentAlt: '#0E9BB5',
    accentGradient: ['#6A5AE0', '#22B8CF'],
    onAccent: '#FFFFFF',
    accentSoft: 'rgba(106,90,224,0.12)',

    warm: '#E8734A',

    success: '#12946A',
    warning: '#B57A12',
    danger: '#D2503F',
    info: '#2C6FD1',

    inputBg: 'rgba(255,255,255,0.85)',
    inputBorder: 'rgba(15,23,42,0.10)',

    scrim: 'rgba(17,24,39,0.32)',
    shadowColor: '#1E293B',
    divider: 'rgba(15,23,42,0.07)',

    bubbleOut: 'rgba(106,90,224,0.13)',
    bubbleIn: 'rgba(255,255,255,0.92)',
    bubbleOutBorder: 'rgba(106,90,224,0.22)',
    bubbleInBorder: 'rgba(15,23,42,0.07)',
  },
};

/**
 * Claude Warm — a warm cream reading surface with the terracotta accent,
 * after the Claude.ai web interface.
 */
const claudeWarm: Theme = {
  id: 'claude-warm',
  name: 'Claude Warm',
  description: 'Cream paper, terracotta accents, editorial calm',
  mode: 'light',
  swatch: ['#F5F1EA', '#D97757', '#8A6A4F'],
  colors: {
    background: '#F5F1EA',
    gradient: ['#FBF9F5', '#F5F1EA', '#EDE6DA'],

    auroraA: '#EDB79D',
    auroraB: '#DCCBA9',
    auroraC: '#C7B9A3',
    auroraOpacity: 0.55,

    surface: 'rgba(255,255,255,0.66)',
    surfaceElevated: 'rgba(255,255,255,0.90)',
    surfaceBorder: 'rgba(61,51,41,0.10)',
    surfaceHighlight: 'rgba(255,255,255,0.95)',

    textPrimary: '#2A2521',
    textSecondary: 'rgba(42,37,33,0.64)',
    textMuted: 'rgba(42,37,33,0.42)',

    accent: '#C96442',
    accentAlt: '#8A6A4F',
    accentGradient: ['#DB7F5D', '#BC5334'],
    onAccent: '#FFFFFF',
    accentSoft: 'rgba(201,100,66,0.13)',

    warm: '#D97757',

    success: '#3F8F5F',
    warning: '#B98621',
    danger: '#BE4E38',
    info: '#4A6E9C',

    inputBg: 'rgba(255,255,255,0.72)',
    inputBorder: 'rgba(61,51,41,0.13)',

    scrim: 'rgba(42,37,33,0.30)',
    shadowColor: '#3D332A',
    divider: 'rgba(61,51,41,0.10)',

    bubbleOut: 'rgba(217,119,87,0.16)',
    bubbleIn: 'rgba(255,255,255,0.92)',
    bubbleOutBorder: 'rgba(217,119,87,0.26)',
    bubbleInBorder: 'rgba(61,51,41,0.09)',
  },
};

/**
 * Midnight — a restrained, low-chroma dark theme for maximum legibility.
 */
const midnight: Theme = {
  id: 'midnight',
  name: 'Midnight',
  description: 'Quiet, low-chroma dark for long sessions',
  mode: 'dark',
  swatch: ['#0B0D12', '#4F8CFF', '#22D3EE'],
  colors: {
    background: '#0B0D12',
    gradient: ['#13161E', '#0B0D12', '#07090D'],

    auroraA: '#3B6FF5',
    auroraB: '#8B5CF6',
    auroraC: '#0EA5E9',
    auroraOpacity: 0.22,

    surface: 'rgba(255,255,255,0.045)',
    surfaceElevated: 'rgba(255,255,255,0.075)',
    surfaceBorder: 'rgba(255,255,255,0.09)',
    surfaceHighlight: 'rgba(255,255,255,0.14)',

    textPrimary: '#E8ECF4',
    textSecondary: 'rgba(232,236,244,0.64)',
    textMuted: 'rgba(232,236,244,0.40)',

    accent: '#4F8CFF',
    accentAlt: '#22D3EE',
    accentGradient: ['#4F8CFF', '#22D3EE'],
    onAccent: '#FFFFFF',
    accentSoft: 'rgba(79,140,255,0.15)',

    warm: '#F59E6B',

    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
    info: '#60A5FA',

    inputBg: 'rgba(255,255,255,0.04)',
    inputBorder: 'rgba(255,255,255,0.09)',

    scrim: 'rgba(3,5,9,0.76)',
    shadowColor: '#000000',
    divider: 'rgba(255,255,255,0.06)',

    bubbleOut: 'rgba(79,140,255,0.16)',
    bubbleIn: 'rgba(255,255,255,0.05)',
    bubbleOutBorder: 'rgba(79,140,255,0.28)',
    bubbleInBorder: 'rgba(255,255,255,0.08)',
  },
};

export const THEMES: Record<ResolvedThemeId, Theme> = {
  'aurora-dark': auroraDark,
  'aurora-light': auroraLight,
  'claude-warm': claudeWarm,
  midnight: midnight,
};

/** Which concrete theme a mode resolves to when "System" is selected. */
export const SYSTEM_THEME_BY_MODE = {
  dark: 'aurora-dark',
  light: 'aurora-light',
} as const;

export const THEME_LIST: ThemeMeta[] = [
  {
    id: 'system',
    name: 'System',
    description: 'Follows your device appearance',
    mode: 'auto',
    swatch: ['#0B0C1A', '#F7F8FC', '#7C6BFF'],
  },
  { id: auroraDark.id, name: auroraDark.name, description: auroraDark.description, mode: 'dark', swatch: auroraDark.swatch },
  { id: auroraLight.id, name: auroraLight.name, description: auroraLight.description, mode: 'light', swatch: auroraLight.swatch },
  { id: claudeWarm.id, name: claudeWarm.name, description: claudeWarm.description, mode: 'light', swatch: claudeWarm.swatch },
  { id: midnight.id, name: midnight.name, description: midnight.description, mode: 'dark', swatch: midnight.swatch },
];

export const DEFAULT_THEME_ID: import('./types').ThemeId = 'aurora-dark';
