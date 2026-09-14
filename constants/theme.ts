import { Platform } from 'react-native';

export const colors = {
  bg: '#0A0B0F',
  bgElevated: '#11131A',
  surface: 'rgba(255,255,255,0.04)',
  surfaceStrong: 'rgba(255,255,255,0.08)',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',
  text: '#F3F4F8',
  textMuted: '#9AA0AE',
  textDim: '#5F6573',
  accent: '#7C9CFF',
  accentSoft: 'rgba(124,156,255,0.16)',
  mint: '#6EE7B7',
  mintSoft: 'rgba(110,231,183,0.14)',
  amber: '#FBBF24',
  amberSoft: 'rgba(251,191,36,0.14)',
  rose: '#FB7185',
  roseSoft: 'rgba(251,113,133,0.14)',
  violet: '#C4B5FD',
  code: '#A5B4FC',
} as const;

export const fonts = {
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string,
  sans: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }) as string,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
} as const;

export const scoreColor = (score: number): string => {
  if (score >= 75) return colors.mint;
  if (score >= 55) return colors.accent;
  if (score >= 40) return colors.amber;
  return colors.rose;
};

export const fitLabel = (score: number): string => {
  if (score >= 80) return 'STRONG FIT';
  if (score >= 65) return 'GOOD FIT';
  if (score >= 50) return 'MIXED FIT';
  if (score >= 35) return 'WEAK FIT';
  return 'POOR FIT';
};
