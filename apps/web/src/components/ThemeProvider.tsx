'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { ThemeMode } from '@/styles/theme';

const ThemeContext = createContext<{
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  /** True after client has read localStorage / prefers-color-scheme — use to avoid hydration mismatches. */
  mounted: boolean;
} | null>(null);

const STORAGE_KEY = 'lankamenus-theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (stored === 'light' || stored === 'dark') {
      setThemeState(stored);
    } else if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setThemeState('dark');
    }
  }, []);

  useEffect(() => {
    if (!mounted || typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, mounted]);

  const setTheme = (mode: ThemeMode) => setThemeState(mode);
  const toggleTheme = () => setThemeState((t) => (t === 'light' ? 'dark' : 'light'));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
