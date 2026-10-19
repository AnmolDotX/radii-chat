import { Platform } from 'react-native';

export const Palette = {
  dark: {
    // Apple / Material Solid Dark Surfaces (Deep, sleek, soothing on eyes)
    background: '#0D0E12',
    surface: '#17191E',
    surfaceElevated: '#21242B',
    surfaceHighlight: '#2B303A',

    // Borderless - no border at all across cards and sheets
    border: 'transparent',
    borderSubtle: 'transparent',
    divider: 'rgba(255, 255, 255, 0.08)',

    // Professional Apple Solid Typography
    text: '#FFFFFF',
    textSecondary: '#969DAA',
    textTertiary: '#5C6270',

    // Brand Signature Accent: #00c20d (Splash Screen Hex)
    accentCyan: '#00c20d',
    accentCyanMuted: 'rgba(0, 194, 13, 0.16)',
    accentGreen: '#00c20d',
    accentGreenMuted: 'rgba(0, 194, 13, 0.16)',
    accentBlue: '#00c20d',
    accentBlueMuted: 'rgba(0, 194, 13, 0.16)',

    // Material System States
    success: '#00c20d',
    successMuted: 'rgba(0, 194, 13, 0.18)',
    warning: '#FF9F0A',
    warningMuted: 'rgba(255, 159, 10, 0.16)',
    danger: '#FF453A',
    dangerMuted: 'rgba(255, 69, 58, 0.16)',

    // Radii Plus
    plus: '#AF52DE',
    plusMuted: 'rgba(175, 82, 222, 0.16)',
    plusGold: '#FFD60A',
  },
  light: {
    // Apple / Material Solid Light Surfaces (Clean, soft, zero glare)
    background: '#F4F5F8',
    surface: '#FFFFFF',
    surfaceElevated: '#E9EBF0',
    surfaceHighlight: '#DCE0E8',

    // Borderless - no border at all across cards and sheets
    border: 'transparent',
    borderSubtle: 'transparent',
    divider: 'rgba(0, 0, 0, 0.06)',

    // Professional Apple Solid Typography
    text: '#121316',
    textSecondary: '#656B77',
    textTertiary: '#9AA0AC',

    // Brand Signature Accent: #00c20d (Splash Screen Hex)
    accentCyan: '#00c20d',
    accentCyanMuted: 'rgba(0, 194, 13, 0.12)',
    accentGreen: '#00c20d',
    accentGreenMuted: 'rgba(0, 194, 13, 0.12)',
    accentBlue: '#00c20d',
    accentBlueMuted: 'rgba(0, 194, 13, 0.12)',

    // Material System States
    success: '#00c20d',
    successMuted: 'rgba(0, 194, 13, 0.14)',
    warning: '#F59E0B',
    warningMuted: 'rgba(245, 158, 11, 0.14)',
    danger: '#EF4444',
    dangerMuted: 'rgba(239, 68, 68, 0.14)',

    // Radii Plus
    plus: '#8E24AA',
    plusMuted: 'rgba(142, 36, 170, 0.12)',
    plusGold: '#F59E0B',
  },
} as const;

export type ThemeColors = {
  [K in keyof typeof Palette.dark]: string;
};

export const Shadows = {
  subtle: {
    shadowColor: Platform.select({
      android: 'rgba(0, 0, 0, 0.06)',
      default: '#000000',
    }),
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  card: {
    shadowColor: Platform.select({
      android: 'rgba(0, 0, 0, 0.07)',
      default: '#000000',
    }),
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.025,
    shadowRadius: 6,
    elevation: 1,
  },
  elevated: {
    shadowColor: Platform.select({
      android: 'rgba(0, 0, 0, 0.10)',
      default: '#000000',
    }),
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
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
