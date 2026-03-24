'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from './ThemeContext';
import { THEMES, THEME_KEYS } from './themes';
import type { CustomCandles } from './ThemeContext';
import type { ChartTheme } from './themes';

// ============================================================================
// SETTINGS PANEL
// ============================================================================

const MONO = "'SF Mono', 'JetBrains Mono', 'Fira Code', ui-monospace, monospace";

/** Small candle-preview thumbnail for theme selector */
function ThemeThumbnail({
  themeKey,
  themeDef,
  isActive,
  onClick,
}: {
  themeKey: string;
  themeDef: ChartTheme;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={themeDef.name}
      style={{
        width: 56,
        height: 40,
        borderRadius: 4,
        border: isActive ? `2px solid ${themeDef.accent}` : `1px solid ${themeDef.border}`,
        background: themeDef.bg,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        flexShrink: 0,
        transition: 'border-color 0.15s',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Mini candle up */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 1, height: 6, background: themeDef.candleUpWick }} />
        <div style={{ width: 6, height: 12, background: themeDef.candleUpBody, borderRadius: 1 }} />
        <div style={{ width: 1, height: 4, background: themeDef.candleUpWick }} />
      </div>
      {/* Mini candle down */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 1, height: 4, background: themeDef.candleDownWick }} />
        <div style={{ width: 6, height: 10, background: themeDef.candleDownBody, borderRadius: 1 }} />
        <div style={{ width: 1, height: 6, background: themeDef.candleDownWick }} />
      </div>
      {/* Theme name */}
      <div
        style={{
          position: 'absolute',
          bottom: 1,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: 7,
          fontWeight: 600,
          letterSpacing: '0.04em',
          color: themeDef.textSecondary,
          fontFamily: MONO,
        }}
      >
        {themeDef.name.toUpperCase()}
      </div>
    </button>
  );
}

/** Simple color swatch + native input */
function ColorPicker({
  label,
  value,
  onChange,
  theme,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  theme: ChartTheme;
}) {
  return (
    <div className="flex items-center" style={{ gap: 8 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.04em',
          color: theme.textSecondary,
          fontFamily: MONO,
          width: 38,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <div style={{ position: 'relative', width: 24, height: 24 }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 4,
            background: value,
            border: `1px solid ${theme.border}`,
          }}
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0,
            cursor: 'pointer',
            width: '100%',
            height: '100%',
          }}
        />
      </div>
      <span
        style={{
          fontSize: 10,
          color: theme.textDim,
          fontFamily: MONO,
          letterSpacing: '0.02em',
        }}
      >
        {value.toUpperCase()}
      </span>
    </div>
  );
}

// ============================================================================
// MAIN SETTINGS PANEL
// ============================================================================

export default function SettingsPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { theme, themeName, setTheme, customCandles, setCustomCandles } = useTheme();
  const panelRef = useRef<HTMLDivElement>(null);

  // Local candle state for editing
  const [localCandles, setLocalCandles] = useState<{
    upBody: string;
    upWick: string;
    downBody: string;
    downWick: string;
    levelUpper: string;
    levelLower: string;
  }>({
    upBody: theme.candleUpBody,
    upWick: theme.candleUpWick,
    downBody: theme.candleDownBody,
    downWick: theme.candleDownWick,
    levelUpper: theme.levelBlue,
    levelLower: theme.levelPurple,
  });

  // Sync local candle state when theme changes or custom candles change
  useEffect(() => {
    setLocalCandles({
      upBody: theme.candleUpBody,
      upWick: theme.candleUpWick,
      downBody: theme.candleDownBody,
      downWick: theme.candleDownWick,
      levelUpper: theme.levelBlue,
      levelLower: theme.levelPurple,
    });
  }, [theme.candleUpBody, theme.candleUpWick, theme.candleDownBody, theme.candleDownWick]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleCandleChange = useCallback(
    (field: keyof CustomCandles, value: string) => {
      const updated = { ...localCandles, [field]: value };
      setLocalCandles(updated as typeof localCandles);
      setCustomCandles({
        upBody: updated.upBody,
        upWick: updated.upWick,
        downBody: updated.downBody,
        downWick: updated.downWick,
        levelUpper: updated.levelUpper,
        levelLower: updated.levelLower,
      });
    },
    [localCandles, setCustomCandles],
  );

  const handleResetCandles = useCallback(() => {
    setCustomCandles(null);
  }, [setCustomCandles]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 90,
          background: 'rgba(0,0,0,0.2)',
        }}
      />

      {/* Slide-out panel */}
      <div
        ref={panelRef}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 280,
          zIndex: 100,
          background: theme.bg,
          borderLeft: `1px solid ${theme.border}`,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: MONO,
          boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
          animation: 'slideInRight 0.15s ease-out',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{
            height: 44,
            padding: '0 16px',
            borderBottom: `1px solid ${theme.border}`,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: theme.text,
            }}
          >
            SETTINGS
          </span>
          <button
            onClick={onClose}
            style={{
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.textDim,
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              padding: 0,
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = theme.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = theme.textDim; }}
          >
            <svg width={10} height={10} viewBox="0 0 10 10" stroke="currentColor" strokeWidth={1.5}>
              <line x1={1} y1={1} x2={9} y2={9} />
              <line x1={9} y1={1} x2={1} y2={9} />
            </svg>
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto" style={{ padding: 16 }}>
          {/* ---- Theme selector ---- */}
          <div style={{ marginBottom: 24 }}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: theme.textDim,
                display: 'block',
                marginBottom: 10,
              }}
            >
              THEME
            </span>
            <div className="flex flex-wrap" style={{ gap: 8 }}>
              {THEME_KEYS.map((key) => (
                <ThemeThumbnail
                  key={key}
                  themeKey={key}
                  themeDef={THEMES[key]}
                  isActive={themeName === key}
                  onClick={() => setTheme(key)}
                />
              ))}
            </div>
          </div>

          {/* ---- Candle colors ---- */}
          <div>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: theme.textDim,
                display: 'block',
                marginBottom: 10,
              }}
            >
              CANDLE COLORS
            </span>

            {/* UP */}
            <div style={{ marginBottom: 12 }}>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: theme.positive,
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                UP
              </span>
              <div className="flex flex-col" style={{ gap: 6, paddingLeft: 4 }}>
                <ColorPicker
                  label="Body"
                  value={localCandles.upBody}
                  onChange={(c) => handleCandleChange('upBody', c)}
                  theme={theme}
                />
                <ColorPicker
                  label="Wick"
                  value={localCandles.upWick}
                  onChange={(c) => handleCandleChange('upWick', c)}
                  theme={theme}
                />
              </div>
            </div>

            {/* DOWN */}
            <div style={{ marginBottom: 16 }}>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: theme.negative,
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                DOWN
              </span>
              <div className="flex flex-col" style={{ gap: 6, paddingLeft: 4 }}>
                <ColorPicker
                  label="Body"
                  value={localCandles.downBody}
                  onChange={(c) => handleCandleChange('downBody', c)}
                  theme={theme}
                />
                <ColorPicker
                  label="Wick"
                  value={localCandles.downWick}
                  onChange={(c) => handleCandleChange('downWick', c)}
                  theme={theme}
                />
              </div>
            </div>

            {/* LEVEL COLORS */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: theme.textDim, marginBottom: 8 }}>
                LEVEL COLORS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <ColorPicker
                  label="Upper"
                  value={localCandles.levelUpper}
                  onChange={(c) => handleCandleChange('levelUpper', c)}
                  theme={theme}
                />
                <ColorPicker
                  label="Lower"
                  value={localCandles.levelLower}
                  onChange={(c) => handleCandleChange('levelLower', c)}
                  theme={theme}
                />
              </div>
            </div>

            {/* Reset button */}
            {customCandles && (<div style={{ marginTop: 16 }}>
              <button
                onClick={handleResetCandles}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  fontFamily: MONO,
                  padding: '6px 12px',
                  background: 'transparent',
                  border: `1px solid ${theme.border}`,
                  color: theme.textSecondary,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  borderRadius: 3,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = theme.textDim;
                  e.currentTarget.style.color = theme.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = theme.border;
                  e.currentTarget.style.color = theme.textSecondary;
                }}
              >
                Reset to theme defaults
              </button>
            </div>)}
          </div>
        </div>
      </div>

      {/* Animation keyframe */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
