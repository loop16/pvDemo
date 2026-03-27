'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ChartTheme } from './themes';
import { getTheme, THEME_KEYS } from './themes';

// ============================================================================
// TYPES
// ============================================================================

export interface CustomCandles {
  upBody?: string;
  upWick?: string;
  downBody?: string;
  downWick?: string;
  levelUpper?: string;
  levelLower?: string;
}

export interface ThemeContextValue {
  theme: ChartTheme;
  themeName: string;
  setTheme: (name: string) => void;
  customCandles: CustomCandles | null;
  setCustomCandles: (candles: CustomCandles | null) => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ============================================================================
// LOCAL STORAGE KEYS
// ============================================================================

const LS_THEME_KEY = 'pricevault-theme';
const LS_CANDLES_KEY = 'pricevault-custom-candles';

function readLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLS(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage full or disabled — silently ignore
  }
}

// ============================================================================
// PROVIDER
// ============================================================================

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState<string>('pricevault');
  const [customCandles, setCustomCandlesState] = useState<CustomCandles | null>(null);
  const [mounted, setMounted] = useState(false);

  // Read persisted values on mount
  useEffect(() => {
    const saved = readLS<string>(LS_THEME_KEY, 'pricevault');
    if (THEME_KEYS.includes(saved)) {
      setThemeName(saved);
    }
    const savedCandles = readLS<CustomCandles | null>(LS_CANDLES_KEY, null);
    if (savedCandles) {
      setCustomCandlesState(savedCandles);
    }
    setMounted(true);
  }, []);

  const setTheme = useCallback((name: string) => {
    if (!THEME_KEYS.includes(name)) return;
    setThemeName(name);
    writeLS(LS_THEME_KEY, name);
    // Clear custom candle overrides when switching themes
    setCustomCandlesState(null);
    writeLS(LS_CANDLES_KEY, null);
  }, []);

  const setCustomCandles = useCallback((candles: CustomCandles | null) => {
    setCustomCandlesState(candles);
    writeLS(LS_CANDLES_KEY, candles);
  }, []);

  // Build the effective theme with custom candle overrides
  const theme = useMemo(() => {
    const base = getTheme(themeName);
    if (!customCandles) return base;

    // Helper: hex color → rgba strings for box fill/stroke
    const hexToBoxColors = (hex: string, fillAlpha: number, strokeAlpha: number) => {
      const n = parseInt(hex.replace('#', ''), 16);
      const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      return {
        fill: `rgba(${r},${g},${b},${fillAlpha})`,
        stroke: `rgba(${r},${g},${b},${strokeAlpha})`,
      };
    };

    const overrides: Partial<typeof base> = {};
    if (customCandles.upBody) overrides.candleUpBody = customCandles.upBody;
    if (customCandles.upWick) overrides.candleUpWick = customCandles.upWick;
    if (customCandles.downBody) overrides.candleDownBody = customCandles.downBody;
    if (customCandles.downWick) overrides.candleDownWick = customCandles.downWick;
    if (customCandles.levelUpper) {
      overrides.levelBlue = customCandles.levelUpper;
      const box = hexToBoxColors(customCandles.levelUpper, 0.18, 0.35);
      overrides.boxBlueFill = box.fill;
      overrides.boxBlueStroke = box.stroke;
    }
    if (customCandles.levelLower) {
      overrides.levelPurple = customCandles.levelLower;
      const box = hexToBoxColors(customCandles.levelLower, 0.16, 0.30);
      overrides.boxPurpleFill = box.fill;
      overrides.boxPurpleStroke = box.stroke;
    }

    return { ...base, ...overrides };
  }, [themeName, customCandles]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, themeName, setTheme, customCandles, setCustomCandles }),
    [theme, themeName, setTheme, customCandles, setCustomCandles],
  );

  // Render children immediately but with default theme until mounted
  // This prevents hydration mismatches
  if (!mounted) {
    const defaultTheme = getTheme('pricevault');
    return (
      <ThemeContext.Provider
        value={{
          theme: defaultTheme,
          themeName: 'pricevault',
          setTheme,
          customCandles: null,
          setCustomCandles,
        }}
      >
        {children}
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme() must be used within a <ThemeProvider>');
  }
  return ctx;
}
