import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { storage } from '@/src/utils/storage';
import { THEMES, ThemeName, ThemePalette } from './themes';

interface ThemeContextValue {
  themeName: ThemeName;
  colors: ThemePalette;
  setTheme: (name: ThemeName) => Promise<void>;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = 'kizilkan.theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>('netflix');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<string>(STORAGE_KEY, 'netflix');
      if (saved && saved in THEMES) setThemeName(saved as ThemeName);
      setIsLoading(false);
    })();
  }, []);

  const setTheme = useCallback(async (name: ThemeName) => {
    setThemeName(name);
    await storage.setItem(STORAGE_KEY, name);
  }, []);

  return (
    <ThemeContext.Provider value={{ themeName, colors: THEMES[themeName], setTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
