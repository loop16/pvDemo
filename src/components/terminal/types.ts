// ============================================================================
// Terminal Chart Data Types — Pure types, no library dependencies
// ============================================================================

/** A single OHLCV candlestick bar */
export type Bar = {
  time: number;       // UTC timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

/** A level line from the API */
export type LevelLine = {
  name: string;
  value: number;
  style?: 'solid' | 'dashed';
  color?: string;
};

/** API response shape for levels */
export type LevelsResponse = {
  symbol: string;
  asof: string;
  daily: {
    lines: LevelLine[];
  };
  meta?: Record<string, unknown>;
};

/** Quarter range detected from price data */
export type QuarterRange = {
  qkey: string;
  fridayIdx: number;
  prevIdx: number;
  startTime: number;   // UTC seconds
  endTime: number;      // UTC seconds
  high: number;
  low: number;
  mid: number;
  confirm?: { side: 'LONG' | 'SHORT'; time: number };
  falsed?: { time: number };
};

/** A horizontal level segment to render on the chart */
export type LevelSegment = {
  t1: number;          // start time (UTC seconds)
  t2: number;          // end time (UTC seconds)
  price: number;       // absolute price value
  pct: number;         // percentage deviation from mid
  color: string;
  lineWidth: number;
  dashed: boolean;
  style?: 'solid' | 'dotted' | 'dashed';
  label?: string;      // e.g. "20 %", "50 %"
};

/** A probability box (filled rectangle between two price levels) */
export type ProbabilityBox = {
  t1: number;
  t2: number;
  priceLow: number;
  priceHigh: number;
  fill: string;
  stroke: string;
};

/** A mid-band marker */
export type MidBand = {
  t1: number;
  t2: number;
  price: number;
};

/** A text label to render on the chart */
export type ChartLabel = {
  time: number;
  price: number;
  text: string;
  color: string;
  dy: number;
  dx: number;
};

/** The outcome determined from quarter range + price action */
export type OutcomeKey = 'LONG_TRUE' | 'LONG_FALSE' | 'SHORT_TRUE' | 'SHORT_FALSE' | 'NONE';

/** Visible index range for the chart viewport */
export type VisibleRange = {
  fromIdx: number;
  toIdx: number;
};

/** Layout mode for multi-panel */
export type LayoutMode = '1x1' | '1x2' | '2x1' | '2x2';

/** Panel configuration */
export type PanelConfig = {
  id: string;
  symbol: string;
  model: 'simple' | 'pro' | 'beta' | 'overlay';
  overlaySymbol?: string;
  scenario?: 'AUTO' | 'LONG_TRUE' | 'LONG_FALSE' | 'SHORT_TRUE' | 'SHORT_FALSE';
};

/** Asset class for symbol classification */
export type AssetClass = 'equity' | 'crypto' | 'futures' | 'fx' | 'index' | 'etf';

/** Symbol entry from /api/symbols */
export type SymbolEntry = {
  id: string;
  label: string;
  class?: AssetClass;
};
