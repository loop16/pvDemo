/**
 * Shared types for the Pricevault terminal system.
 * Used by both the Canvas Chart (Agent: Terminal) and the Stats/Movers page (Agent: Stats).
 *
 * These types are LIBRARY-AGNOSTIC: no dependency on lightweight-charts.
 * Time is always unix seconds (number), not UTCTimestamp.
 */

// ---------------------------------------------------------------------------
// Core data types (match API response shapes)
// ---------------------------------------------------------------------------

/** A single OHLCV bar. `time` is unix seconds (UTC). */
export type OhlcBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

/** A single level line from the /api/levels response. */
export type LevelLine = {
  name: string;            // e.g. "LONG_TRUE_1", "Short_High_20"
  value: number;           // percentage offset from quarter mid
  style?: string;          // "solid" | "dashed" | "dotted"
  color?: string;          // optional hex or rgba
};

/** Full /api/levels response shape. */
export type LevelsResponse = {
  symbol: string;
  asof?: string;
  daily: {
    lines: LevelLine[];
  };
  meta?: {
    beta?: {
      volRatio: number;
      rawVolRatio: number;
      beta: number;
      lookbackDays: number;
      benchmark: string;
      sampleSize: number;
    };
    [key: string]: unknown;
  };
};

/** Symbol entry from /api/symbols. */
export type SymbolEntry = {
  id: string;       // ticker, e.g. "SPX", "NQ", "BTCUSD"
  label: string;    // display name, e.g. "S&P 500"
};

// ---------------------------------------------------------------------------
// Quarter detection types (derived from bars)
// ---------------------------------------------------------------------------

/** A quarter range detected from price data. */
export type QuarterRange = {
  qkey: string;           // e.g. "2025-Q2"
  fridayIdx: number;      // bar index of the first Friday
  prevIdx: number;        // bar index of the day before first Friday
  startTime: number;      // unix seconds: first Friday timestamp
  endTime: number;        // unix seconds: end of quarter
  high: number;           // highest price in the range bar pair
  low: number;            // lowest price in the range bar pair
  mid: number;            // (high + low) / 2
  confirm?: {
    side: 'LONG' | 'SHORT';
    time: number;
  };
  falsed?: {
    time: number;
  };
};

// ---------------------------------------------------------------------------
// Model & scenario types
// ---------------------------------------------------------------------------

export type ModelKey = 'simple' | 'pro' | 'beta' | 'overlay';

export type OutcomeKey =
  | 'AUTO'
  | 'LONG_TRUE'
  | 'LONG_FALSE'
  | 'SHORT_TRUE'
  | 'SHORT_FALSE'
  | 'NONE';

// ---------------------------------------------------------------------------
// Chart rendering primitives
// ---------------------------------------------------------------------------

/** A horizontal line segment on the chart (a level). */
export type LevelSegment = {
  t1: number;        // start time (unix seconds)
  t2: number;        // end time (unix seconds)
  price: number;     // y-axis value (absolute price)
  pct: number;       // the original percentage offset from mid
  color: string;     // rgba or hex
  width: 1 | 2 | 3; // stroke width
  style: 'solid' | 'dotted' | 'dashed';
};

/** A filled rectangle (probability box). */
export type PriceBox = {
  t1: number;
  t2: number;
  priceLow: number;
  priceHigh: number;
  fill: string;
  stroke: string;
};

/** A mid-band (thin horizontal highlight spanning a quarter). */
export type MidBand = {
  t1: number;
  t2: number;
  price: number;
};

/** A text label anchored to a point on the chart. */
export type ChartLabel = {
  time: number;
  price: number;
  text: string;
  color: string;
  dy: number;       // vertical pixel offset from computed y
  dx: number;       // horizontal pixel offset from computed x
};

// ---------------------------------------------------------------------------
// Quarter level summary (for side panel display)
// ---------------------------------------------------------------------------

export type QuarterLevels = {
  upper20: number;
  upper50: number;
  upper80: number;
  lower20: number;
  lower50: number;
  lower80: number;
};

// ---------------------------------------------------------------------------
// Multi-panel layout types
// ---------------------------------------------------------------------------

export type PanelId = string; // UUID or ordinal like "panel-0"

export type PanelLayout = '1x1' | '1x2' | '2x1' | '2x2';

/** State of a single chart panel within the tiling layout. */
export type PanelState = {
  id: PanelId;
  symbol: string;
  model: ModelKey;
  outcome: OutcomeKey;
  bars: OhlcBar[];
  levels: LevelsResponse | null;
  quarterLevels: QuarterLevels | null;
};

// ---------------------------------------------------------------------------
// Stats / Movers types
// ---------------------------------------------------------------------------

/** One row in the movers table: a symbol with its distance from median. */
export type MoverRow = {
  symbol: string;
  label: string;
  price: number;              // latest close
  quarterMid: number;         // mid of the current quarter range
  distFromMid: number;        // (price - mid) / mid * 100  (signed %)
  absDistFromMid: number;     // absolute value for sorting
  side: 'above' | 'below';   // above or below the median
  changePct: number;          // daily change %
};

/** Aggregated stats for the movers page. */
export type MoversStats = {
  totalSymbols: number;
  aboveMedian: number;
  belowMedian: number;
  topMovers: MoverRow[];      // sorted by absDistFromMid descending
  asof: string;               // date of the data
};
