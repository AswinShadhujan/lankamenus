/**
 * Centralized design system for Lankamenus.
 * Use with CSS variables in globals.css for light/dark and components.
 */

export const colors = {
  // Accents (unchanged in dark mode)
  primary: '#C30017',
  secondary: '#FF8000',

  // Light mode
  light: {
    background: '#FFFFFF',
    surface: '#F6F6F6',
    textPrimary: '#000000',
    textSecondary: '#000000',
    border: '#E5E5E5',
  },

  // Dark mode
  dark: {
    background: '#0E0E0E',
    surface: '#1A1A1A',
    textPrimary: '#FFFFFF',
    textSecondary: '#FFFFFF',
    border: '#2C2C2C',
  },
} as const;

export const spacing = {
  4: '4px',
  8: '8px',
  16: '16px',
  24: '24px',
  32: '32px',
} as const;

export const borderRadius = {
  md: '8px',
  lg: '12px',
} as const;

export const transition = '0.2s ease';

export type ThemeMode = 'light' | 'dark';
