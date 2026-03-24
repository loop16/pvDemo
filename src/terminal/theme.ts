/**
 * Terminal Theme Constants
 * Shared by both the canvas chart system and the stats/movers page.
 * Single source of truth for all colors, fonts, and spacing.
 */

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------

export const T = {
  // Backgrounds
  bg:           '#0a0a0a',   // primary background (near-black)
  bgPanel:      '#111111',   // panel / card background
  bgSurface:    '#1a1a1a',   // elevated surface (inputs, dropdowns)
  bgHover:      '#222222',   // hover state
  bgSelected:   '#2a2a2a',   // selected / active row

  // Borders
  border:       '#2a2a2a',   // subtle border
  borderLight:  '#333333',   // slightly more visible border
  borderFocus:  '#4a4a4a',   // focused input border

  // Text
  text:         '#e0e0e0',   // primary text (off-white)
  textDim:      '#888888',   // secondary / muted text
  textMuted:    '#555555',   // tertiary / disabled text
  textBright:   '#ffffff',   // emphasized text

  // Accent colors
  green:        '#00d672',   // bullish / up / positive
  greenDim:     '#00a858',   // muted green
  greenBg:      'rgba(0,214,114,0.08)', // green tint background
  red:          '#ff4444',   // bearish / down / negative
  redDim:       '#cc3333',   // muted red
  redBg:        'rgba(255,68,68,0.08)', // red tint background
  amber:        '#ffaa00',   // warning / neutral highlight
  amberDim:     '#cc8800',
  blue:         '#4488ff',   // info / links / upper levels
  blueDim:      '#3366cc',
  purple:       '#aa66ff',   // secondary accent / lower levels
  purpleDim:    '#8844cc',
  cyan:         '#00cccc',   // crosshair / auxiliary

  // Chart-specific
  candleUp:     '#00d672',   // bullish candle body
  candleDown:   '#ff4444',   // bearish candle body
  wickUp:       '#00a858',   // bullish wick
  wickDown:     '#cc3333',   // bearish wick
  gridLine:     '#1a1a1a',   // chart grid lines
  crosshair:    '#555555',   // crosshair line

  // Level-line colors
  levelBlue:    'rgba(68,136,255,0.85)',
  levelPurple:  'rgba(170,102,255,0.85)',
  levelMid:     'rgba(255,170,0,0.70)',

  // Box fills (probability boxes)
  boxBlueFill:   'rgba(68,136,255,0.12)',
  boxBlueStroke: 'rgba(68,136,255,0.40)',
  boxPurpleFill: 'rgba(170,102,255,0.12)',
  boxPurpleStroke:'rgba(170,102,255,0.40)',
  boxRedFill:    'rgba(255,68,68,0.10)',
  boxRedStroke:  'rgba(255,68,68,0.35)',
  boxGreenFill:  'rgba(0,214,114,0.10)',
  boxGreenStroke: 'rgba(0,214,114,0.35)',
} as const;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const FONT = {
  mono:  "'SF Mono', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', ui-monospace, monospace",
  sans:  "system-ui, -apple-system, sans-serif",
} as const;

export const FONT_SIZE = {
  xs:   10,
  sm:   11,
  base: 13,
  md:   14,
  lg:   16,
  xl:   20,
  xxl:  28,
} as const;

// ---------------------------------------------------------------------------
// Spacing / Layout
// ---------------------------------------------------------------------------

export const LAYOUT = {
  headerH:      40,       // terminal header bar height
  statusBarH:   24,       // bottom status bar height
  panelGap:     2,        // gap between tiled chart panels
  sidebarW:     300,      // sidebar width
  borderRadius: 0,        // sharp corners everywhere
  padding: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert hex to rgba with given alpha */
export function hexA(hex: string, a = 1): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

/** Darken a color by a factor (0..1). Works with hex and rgba. */
export function darken(color: string, factor = 0.75, alpha = 1): string {
  const mHex = /^#([0-9a-f]{3,8})$/i.exec(color);
  if (mHex) {
    let hex = mHex[1];
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    const n = parseInt(hex.slice(0, 6), 16);
    const r = Math.round(((n >> 16) & 255) * factor);
    const g = Math.round(((n >> 8) & 255) * factor);
    const b = Math.round((n & 255) * factor);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const mRgba = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/i.exec(color);
  if (mRgba) {
    const r = Math.round(+mRgba[1] * factor);
    const g = Math.round(+mRgba[2] * factor);
    const b = Math.round(+mRgba[3] * factor);
    const a = mRgba[4] != null ? Math.min(1, +mRgba[4] * alpha) : alpha;
    return `rgba(${r},${g},${b},${a})`;
  }
  return color;
}
