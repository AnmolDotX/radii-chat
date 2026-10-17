import { Platform } from 'react-native';

export const Palette = {
  dark: {
    // Material 3 Dark Solid Surfaces
    background: '#121212',
    surface: '#1E1E1E',
    surfaceElevated: '#252525',
    surfaceHighlight: '#2C2C2C',

    // Solid Borders (No Gradients)
    border: '#333333',
    borderSubtle: '#222222',

    // Typography
    text: '#FFFFFF',
    textSecondary: '#B3B3B3',
    textTertiary: '#757575',

    // Brand Signature Accent: #00c20d Green
    accentCyan: '#00c20d',
    accentCyanMuted: 'rgba(0, 194, 13, 0.14)',
    accentBlue: '#2196F3',
    accentBlueMuted: 'rgba(33, 150, 243, 0.14)',

    // Material System States
    success: '#00c20d',
    successMuted: 'rgba(0, 194, 13, 0.16)',
    warning: '#FFA000',
    warningMuted: 'rgba(255, 160, 0, 0.16)',
    danger: '#F44336',
    dangerMuted: 'rgba(244, 67, 54, 0.16)',

    // Orbitor Plus
    plus: '#9C27B0',
    plusMuted: 'rgba(156, 39, 176, 0.16)',
    plusGold: '#FFB300',
  },
  light: {
    // Material 3 Light Solid Surfaces
    background: '#F8F9FA',
    surface: '#FFFFFF',
    surfaceElevated: '#F1F3F4',
    surfaceHighlight: '#E8EAED',

    // Solid Borders (No Gradients)
    border: '#DADCE0',
    borderSubtle: '#E0E0E0',

    // Typography
    text: '#202124',
    textSecondary: '#5F6368',
    textTertiary: '#80868B',

    // Brand Signature Accent: #00c20d Green
    accentCyan: '#00c20d',
    accentCyanMuted: 'rgba(0, 194, 13, 0.12)',
    accentBlue: '#1A73E8',
    accentBlueMuted: 'rgba(26, 115, 232, 0.12)',

    // Material System States
    success: '#00c20d',
    successMuted: 'rgba(0, 194, 13, 0.14)',
    warning: '#F29900',
    warningMuted: 'rgba(242, 153, 0, 0.14)',
    danger: '#D93025',
    dangerMuted: 'rgba(217, 48, 37, 0.14)',

    // Orbitor Plus
    plus: '#8E24AA',
    plusMuted: 'rgba(142, 36, 170, 0.12)',
    plusGold: '#F9AB00',
  },
} as const;

export type ThemeColors = {
  [K in keyof typeof Palette.dark]: string;
};

export const Typography = {
  fontFamily: Platform.select({
    ios: 'system-ui',
    android: 'sans-serif-medium',
    default: 'system-ui',
  }),
  monoFamily: Platform.select({
    ios: 'ui-monospace',
    android: 'monospace',
    default: 'monospace',
  }),
  sizes: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    display: 32,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const;

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const Layout = {
  maxContentWidth: 700,
  tabBarHeight: Platform.select({ ios: 64, android: 68, default: 60 }),
} as const;
