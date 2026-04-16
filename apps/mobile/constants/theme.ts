import { Platform } from 'react-native';

/* ── Brand colors ─────────────────────────────────────────────── */
export const Brand = {
  steer:        '#7c3aed',
  steerLight:   '#ede9fe',
  steerDark:    '#5b21b6',
  skill:        '#0d9488',
  skillLight:   '#ccfbf1',
  skillDark:    '#0f766e',
  docuMind:     '#4f46e5',
  docuMindLight:'#e0e7ff',
};

/* ── Semantic colors ──────────────────────────────────────────── */
export const Semantic = {
  success:      '#10b981',
  successBg:    '#d1fae5',
  successText:  '#065f46',
  warning:      '#f59e0b',
  warningBg:    '#fef3c7',
  warningText:  '#78350f',
  danger:       '#ef4444',
  dangerBg:     '#fee2e2',
  dangerText:   '#7f1d1d',
  info:         '#3b82f6',
  infoBg:       '#dbeafe',
  infoText:     '#1e3a5f',
};

/* ── Category colors (Action Points) ─────────────────────────── */
export const Category = {
  names:        { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', accent: '#3b82f6' },
  dates:        { bg: '#fffbeb', border: '#fde68a', text: '#92400e', accent: '#f59e0b' },
  clauses:      { bg: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6', accent: '#8b5cf6' },
  tasks:        { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', accent: '#10b981' },
  risks:        { bg: '#fef2f2', border: '#fecaca', text: '#7f1d1d', accent: '#ef4444' },
};

/* ── Light theme ──────────────────────────────────────────────── */
export const LightTheme = {
  bg:            '#f8fafc',
  surface:       '#ffffff',
  surface2:      '#f1f5f9',
  border:        '#e2e8f0',
  border2:       '#cbd5e1',
  text1:         '#0f172a',
  text2:         '#475569',
  text3:         '#94a3b8',
  tint:          Brand.steer,
  tabActive:     Brand.steer,
  tabInactive:   '#94a3b8',
  shadowColor:   '#000000',
  shadowOpacity: 0.08,
};

/* ── Dark theme ───────────────────────────────────────────────── */
export const DarkTheme = {
  bg:            '#09090f',
  surface:       '#111118',
  surface2:      '#1a1a2e',
  border:        'rgba(255,255,255,0.08)',
  border2:       'rgba(255,255,255,0.12)',
  text1:         '#f1f5f9',
  text2:         '#94a3b8',
  text3:         'rgba(255,255,255,0.3)',
  tint:          '#a78bfa',
  tabActive:     '#a78bfa',
  tabInactive:   'rgba(255,255,255,0.3)',
  shadowColor:   '#000000',
  shadowOpacity: 0.3,
};

/* ── Spacing scale (4px grid) ─────────────────────────────────── */
export const Space = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
};

/* ── Border radius ────────────────────────────────────────────── */
export const Radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
};

/* ── Typography ───────────────────────────────────────────────── */
export const FontSize = {
  xs:   11,
  sm:   13,
  base: 15,
  lg:   17,
  xl:   20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
};

export const FontWeight = {
  normal:    '400' as const,
  medium:    '500' as const,
  semibold:  '600' as const,
  bold:      '700' as const,
  extrabold: '800' as const,
};

/* ── Fonts ────────────────────────────────────────────────────── */
export const Fonts = Platform.select({
  ios:     { sans: 'System', mono: 'Menlo' },
  android: { sans: 'Roboto', mono: 'monospace' },
  default: {
    sans: "Inter, system-ui, -apple-system, sans-serif",
    mono: "SFMono-Regular, Menlo, monospace",
  },
})!;

/* ── Shadows ──────────────────────────────────────────────────── */
export const Shadows = {
  sm: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius:  4,
    elevation:     2,
  },
  md: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius:  10,
    elevation:     4,
  },
  lg: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius:  20,
    elevation:     8,
  },
};

/* ── Legacy compat (for components using Colors.light/dark) ─── */
export const Colors = {
  light: {
    text:           LightTheme.text1,
    background:     LightTheme.bg,
    tint:           LightTheme.tint,
    icon:           LightTheme.text3,
    tabIconDefault: LightTheme.tabInactive,
    tabIconSelected:LightTheme.tabActive,
  },
  dark: {
    text:           DarkTheme.text1,
    background:     DarkTheme.bg,
    tint:           DarkTheme.tint,
    icon:           DarkTheme.text3,
    tabIconDefault: DarkTheme.tabInactive,
    tabIconSelected:DarkTheme.tabActive,
  },
};
