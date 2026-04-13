// ============================================================================
// CHART THEME DEFINITIONS
// ============================================================================

export interface ChartTheme {
  name: string;
  // Backgrounds
  bg: string;
  surface: string;
  panel: string;
  // Borders
  border: string;
  borderLight: string;
  // Text
  text: string;
  textSecondary: string;
  textDim: string;
  // Chart
  gridH: string;
  gridV: string;
  crosshair: string;
  axisText: string;
  // Candles (customizable)
  candleUpBody: string;
  candleUpWick: string;
  candleDownBody: string;
  candleDownWick: string;
  // Levels
  levelBlue: string;
  levelPurple: string;
  boxBlueFill: string;
  boxBlueStroke: string;
  boxPurpleFill: string;
  boxPurpleStroke: string;
  midBand: string;
  // Accents
  accent: string;
  positive: string;
  negative: string;
  // Active nav
  activeNavBg: string;
  // Hover
  hoverBg: string;
  // Badge inverse (for crosshair price badge text)
  badgeText: string;
  // Whether this theme uses frosted glass + halftone background
  frosted: boolean;
}

// ============================================================================
// PRICEVAULT — frosted glass with halftone background, no grid lines
// ============================================================================

export const pricevaultTheme: ChartTheme = {
  name: 'Pricevault',
  bg: '#ffffff',
  surface: '#fafafa',
  panel: '#ffffff',
  border: '#e5e7eb',
  borderLight: '#f0f0f0',
  text: '#111827',
  textSecondary: '#6b7280',
  textDim: '#9ca3af',
  gridH: 'rgba(0,0,0,0.05)',
  gridV: 'rgba(0,0,0,0.03)',
  crosshair: '#d1d5db',
  axisText: '#6b7280',
  candleUpBody: '#16a34a',
  candleUpWick: '#15803d',
  candleDownBody: '#111111',
  candleDownWick: '#111111',
  levelBlue: '#2962ff',
  levelPurple: '#9C27B0',
  boxBlueFill: 'rgba(41,98,255,0.18)',
  boxBlueStroke: 'rgba(41,98,255,0.30)',
  boxPurpleFill: 'rgba(156,39,176,0.16)',
  boxPurpleStroke: 'rgba(156,39,176,0.30)',
  midBand: 'rgba(244,63,94,0.7)',
  accent: '#003087',
  positive: '#16a34a',
  negative: '#dc2626',
  activeNavBg: '#dde6ff',
  hoverBg: '#f8fafc',
  badgeText: '#ffffff',
  frosted: true,
};

// ============================================================================
// LIGHT — clean white, no halftone, with grid lines
// ============================================================================

export const lightTheme: ChartTheme = {
  name: 'Light',
  bg: '#ffffff',
  surface: '#fafafa',
  panel: '#ffffff',
  border: '#e5e7eb',
  borderLight: '#f0f0f0',
  text: '#111827',
  textSecondary: '#6b7280',
  textDim: '#9ca3af',
  gridH: '#f0f0f0',
  gridV: '#f5f5f5',
  crosshair: '#d1d5db',
  axisText: '#6b7280',
  candleUpBody: '#16a34a',
  candleUpWick: '#15803d',
  candleDownBody: '#111111',
  candleDownWick: '#111111',
  levelBlue: '#2962ff',
  levelPurple: '#9C27B0',
  boxBlueFill: 'rgba(41,98,255,0.18)',
  boxBlueStroke: 'rgba(41,98,255,0.30)',
  boxPurpleFill: 'rgba(156,39,176,0.16)',
  boxPurpleStroke: 'rgba(156,39,176,0.30)',
  midBand: 'rgba(244,63,94,0.7)',
  accent: '#2962ff',
  positive: '#16a34a',
  negative: '#dc2626',
  activeNavBg: '#dde6ff',
  hoverBg: '#f8fafc',
  badgeText: '#ffffff',
  frosted: false,
};

// ============================================================================
// DARK
// ============================================================================

export const darkTheme: ChartTheme = {
  name: 'Dark',
  bg: '#141414',
  surface: '#1a1a1a',
  panel: '#161616',
  border: '#2a2a2a',
  borderLight: '#222222',
  text: '#e0e0e0',
  textSecondary: '#888888',
  textDim: '#555555',
  gridH: '#1e1e1e',
  gridV: '#1c1c1c',
  crosshair: '#444444',
  axisText: '#777777',
  candleUpBody: '#26a69a',
  candleUpWick: '#26a69a',
  candleDownBody: '#ef5350',
  candleDownWick: '#ef5350',
  levelBlue: '#42a5f5',
  levelPurple: '#ab47bc',
  boxBlueFill: 'rgba(66,165,245,0.22)',
  boxBlueStroke: 'rgba(66,165,245,0.40)',
  boxPurpleFill: 'rgba(171,71,188,0.18)',
  boxPurpleStroke: 'rgba(171,71,188,0.35)',
  midBand: 'rgba(239,83,80,0.6)',
  accent: '#42a5f5',
  positive: '#26a69a',
  negative: '#ef5350',
  activeNavBg: '#1e2a35',
  hoverBg: '#1e1e1e',
  badgeText: '#141414',
  frosted: false,
};

// ============================================================================
// BLOOMBERG TERMINAL — black bg, orange text, white up / blue down candles
// ============================================================================

export const bloombergTheme: ChartTheme = {
  name: 'Bloomberg',
  bg: '#000000',
  surface: '#0a0a0a',
  panel: '#050505',
  border: '#1a1a1a',
  borderLight: '#141414',
  text: '#ff8c00',
  textSecondary: '#996600',
  textDim: '#4d3300',
  gridH: '#111111',
  gridV: '#0e0e0e',
  crosshair: '#333333',
  axisText: '#996600',
  candleUpBody: '#ffffff',
  candleUpWick: '#cccccc',
  candleDownBody: '#235ee7',
  candleDownWick: '#1a4ab8',
  levelBlue: '#ff8c00',
  levelPurple: '#e04000',
  boxBlueFill: 'rgba(255,140,0,0.20)',
  boxBlueStroke: 'rgba(255,140,0,0.40)',
  boxPurpleFill: 'rgba(224,64,0,0.18)',
  boxPurpleStroke: 'rgba(224,64,0,0.35)',
  midBand: 'rgba(255,140,0,0.65)',
  accent: '#ff8c00',
  positive: '#ffffff',
  negative: '#235ee7',
  activeNavBg: '#1a1200',
  hoverBg: '#0e0e0e',
  badgeText: '#000000',
  frosted: false,
};

// ============================================================================
// THINK OR SWIM — charcoal gray bg, green up / red down, classic TOS look
// ============================================================================

export const tosTheme: ChartTheme = {
  name: 'ThinkOrSwim',
  bg: '#2b2b2b',
  surface: '#333333',
  panel: '#2e2e2e',
  border: '#4a4a4a',
  borderLight: '#3d3d3d',
  text: '#d4d4d4',
  textSecondary: '#999999',
  textDim: '#666666',
  gridH: '#353535',
  gridV: '#323232',
  crosshair: '#555555',
  axisText: '#999999',
  candleUpBody: '#00c805',
  candleUpWick: '#00a004',
  candleDownBody: '#ff0000',
  candleDownWick: '#cc0000',
  levelBlue: '#5b9cf5',
  levelPurple: '#d45dba',
  boxBlueFill: 'rgba(91,156,245,0.12)',
  boxBlueStroke: 'rgba(91,156,245,0.25)',
  boxPurpleFill: 'rgba(212,93,186,0.10)',
  boxPurpleStroke: 'rgba(212,93,186,0.22)',
  midBand: 'rgba(255,165,0,0.5)',
  accent: '#5b9cf5',
  positive: '#00c805',
  negative: '#ff0000',
  activeNavBg: '#3a3a3a',
  hoverBg: '#353535',
  badgeText: '#2b2b2b',
  frosted: false,
};

// ============================================================================
// IBKR TWS — classic gray Windows UI, blue up / red down
// ============================================================================

export const ibkrTheme: ChartTheme = {
  name: 'IBKR',
  bg: '#f0f0f0',
  surface: '#e8e8e8',
  panel: '#f0f0f0',
  border: '#c0c0c0',
  borderLight: '#d8d8d8',
  text: '#333333',
  textSecondary: '#666666',
  textDim: '#999999',
  gridH: '#dcdcdc',
  gridV: '#e2e2e2',
  crosshair: '#aaaaaa',
  axisText: '#666666',
  candleUpBody: '#0000ff',
  candleUpWick: '#0000cc',
  candleDownBody: '#ff0000',
  candleDownWick: '#cc0000',
  levelBlue: '#0055aa',
  levelPurple: '#880088',
  boxBlueFill: 'rgba(0,85,170,0.15)',
  boxBlueStroke: 'rgba(0,85,170,0.30)',
  boxPurpleFill: 'rgba(136,0,136,0.12)',
  boxPurpleStroke: 'rgba(136,0,136,0.25)',
  midBand: 'rgba(204,0,0,0.5)',
  accent: '#0055aa',
  positive: '#0000ff',
  negative: '#ff0000',
  activeNavBg: '#bfcade',
  hoverBg: '#e4e4e4',
  badgeText: '#f0f0f0',
  frosted: false,
};

// ============================================================================
// CODEX — dark terminal, green phosphor, classic CRT hacker aesthetic
// ============================================================================

export const codexTheme: ChartTheme = {
  name: 'Codex',
  bg: '#1a1b26',
  surface: '#1f2133',
  panel: '#1c1d2e',
  border: '#2e3047',
  borderLight: '#262840',
  text: '#c8e6e4',
  textSecondary: '#6bbab5',
  textDim: '#3d6e6b',
  gridH: '#222338',
  gridV: '#202132',
  crosshair: '#3a3c55',
  axisText: '#6bbab5',
  candleUpBody: '#5bc4be',
  candleUpWick: '#4aa8a3',
  candleDownBody: '#e05565',
  candleDownWick: '#c04555',
  levelBlue: '#5bc4be',
  levelPurple: '#7a8acd',
  boxBlueFill: 'rgba(91,196,190,0.16)',
  boxBlueStroke: 'rgba(91,196,190,0.32)',
  boxPurpleFill: 'rgba(122,138,205,0.14)',
  boxPurpleStroke: 'rgba(122,138,205,0.28)',
  midBand: 'rgba(91,196,190,0.55)',
  accent: '#5bc4be',
  positive: '#5bc4be',
  negative: '#e05565',
  activeNavBg: '#242640',
  hoverBg: '#222338',
  badgeText: '#1a1b26',
  frosted: false,
};

// ============================================================================
// CLAUDE — warm cream background, terracotta accents, earthy tones
// ============================================================================

export const claudeTheme: ChartTheme = {
  name: 'Claude',
  bg: '#faf6f1',
  surface: '#f3ede5',
  panel: '#faf6f1',
  border: '#e0d5c7',
  borderLight: '#ebe3d8',
  text: '#3d2e1f',
  textSecondary: '#7a6651',
  textDim: '#b09e8a',
  gridH: '#ede5da',
  gridV: '#f0e9e0',
  crosshair: '#c8b9a6',
  axisText: '#7a6651',
  candleUpBody: '#d97757',
  candleUpWick: '#c0623f',
  candleDownBody: '#3d2e1f',
  candleDownWick: '#3d2e1f',
  levelBlue: '#d97757',
  levelPurple: '#8b5e3c',
  boxBlueFill: 'rgba(217,119,87,0.18)',
  boxBlueStroke: 'rgba(217,119,87,0.35)',
  boxPurpleFill: 'rgba(139,94,60,0.15)',
  boxPurpleStroke: 'rgba(139,94,60,0.30)',
  midBand: 'rgba(217,119,87,0.6)',
  accent: '#d97757',
  positive: '#d97757',
  negative: '#3d2e1f',
  activeNavBg: '#e4cdb8',
  hoverBg: '#f5ede3',
  badgeText: '#faf6f1',
  frosted: false,
};

// ============================================================================
// THEME REGISTRY
// ============================================================================

export const THEMES: Record<string, ChartTheme> = {
  pricevault: pricevaultTheme,
  light: lightTheme,
  claude: claudeTheme,
  codex: codexTheme,
  dark: darkTheme,
  bloomberg: bloombergTheme,
  thinkorswim: tosTheme,
  ibkr: ibkrTheme,
};

export const THEME_KEYS = Object.keys(THEMES) as string[];

export function getTheme(name: string): ChartTheme {
  return THEMES[name] || lightTheme;
}
