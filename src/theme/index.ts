import { useColorScheme } from 'react-native';
import { Palette, ThemeColors } from './tokens';
import { useThemeContext, RadiiThemeProvider, ThemeMode } from './ThemeContext';

export function useOrbitorTheme(): ThemeColors {
  const ctx = useThemeContext();
  const scheme = useColorScheme();
  if (ctx && ctx.theme) {
    return ctx.theme;
  }
  return scheme === 'light' ? Palette.light : Palette.dark;
}

export const useRadiiTheme = useOrbitorTheme;
export { useThemeContext, RadiiThemeProvider };
export type { ThemeMode };
export * from './tokens';
