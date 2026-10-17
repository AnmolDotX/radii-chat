import { useColorScheme } from 'react-native';
import { Palette, ThemeColors, Typography, Spacing, Radius, Layout } from './tokens';

export function useOrbitorTheme(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'light' ? Palette.light : Palette.dark;
}

export * from './tokens';
