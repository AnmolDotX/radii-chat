import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Palette, ThemeColors } from './tokens';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface ThemeContextType {
  theme: ThemeColors;
  isDark: boolean;
  themeMode: ThemeMode;
  resolvedScheme: 'light' | 'dark';
  setThemeMode: (mode: ThemeMode) => void;
}

const THEME_STORAGE_KEY = '@radii_theme_mode';

const ThemeContext = createContext<ThemeContextType>({
  theme: Palette.dark,
  isDark: true,
  themeMode: 'system',
  resolvedScheme: 'dark',
  setThemeMode: () => {},
});

export const RadiiThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setThemeModeState(saved);
        }
      } catch (e) {
        console.warn('Failed to load theme preference:', e);
      }
    })();
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch(() => {});
  }, []);

  const resolvedScheme = useMemo<'light' | 'dark'>(() => {
    if (themeMode === 'light') return 'light';
    if (themeMode === 'dark') return 'dark';
    return systemScheme === 'light' ? 'light' : 'dark';
  }, [themeMode, systemScheme]);

  const isDark = resolvedScheme === 'dark';
  const theme = useMemo(() => Palette[resolvedScheme], [resolvedScheme]);

  const value = useMemo(
    () => ({
      theme,
      isDark,
      themeMode,
      resolvedScheme,
      setThemeMode,
    }),
    [theme, isDark, themeMode, resolvedScheme, setThemeMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useThemeContext(): ThemeContextType {
  return useContext(ThemeContext);
}
