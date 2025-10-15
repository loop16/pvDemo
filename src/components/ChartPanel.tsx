'use client';
import { createChart, ISeriesApi, UTCTimestamp, LineType, PriceScaleMode } from 'lightweight-charts';
import { useEffect, useRef, useState } from 'react';
import { findQuarterRanges, markersFromRanges } from '@/utils/quarters';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function hexA(hex: string, a = 1) {
  const n = parseInt(hex.replace('#',''), 16);
  const r = (n>>16)&255, g = (n>>8)&255, b = n&255;
  return `rgba(${r},${g},${b},${a})`;
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Core data types
type Candle = { time: UTCTimestamp; open:number; high:number; low:number; close:number; volume?: number };
type RangeLite = { startTime: UTCTimestamp; endTime: UTCTimestamp; mid: number };

// Chart rendering types
type Seg = { t1: UTCTimestamp; t2: UTCTimestamp; v: number; pct: number; color: string; w: 1|2|3; dashed?: boolean; style?: 'solid'|'dotted'|'dashed' };
type Box = { t1: UTCTimestamp; t2: UTCTimestamp; pLow: number; pHigh: number; fill: string; stroke: string };
type BoxRange = { t1: UTCTimestamp; t2: UTCTimestamp; mid: number };
type MidBand = { t1: UTCTimestamp; t2: UTCTimestamp; price: number };
type Label = { t: UTCTimestamp; price: number; text: string; color: string; dy: number; dx: number };

// API response types
type LevelsResponse = {
  symbol: string;
  asof: string;
  daily: {
    lines: { name: string; value: number; style?: 'solid'|'dashed'; color?: string }[];
  };
};

// Scenario and outcome types
type OutcomeKey = 'AUTO' | 'LONG_TRUE' | 'LONG_FALSE' | 'SHORT_TRUE' | 'SHORT_FALSE' | 'NONE';
type ScenarioLine = { name: string; value: number | string; style?: string; color?: string };
type PctLine = { pct: number; color?: string };

// ============================================================================
// CONSTANTS
// ============================================================================

// Label configuration
const LABELS_BY_INDEX: Record<number, string> = {
  1: '20 %', 2: '50 %', 3: '80 %', 7: '80 %', 8: '50 %', 9: '20 %',
};

// Text styling
const TEXT_BLUE = '#2962ff';     // Above (upper half) text color
const TEXT_PURPLE = '#9C27B0';  // Below (lower half) text color
const LABEL_OFFSET_PX = 10;      // Vertical offset from level lines

// Mid band styling (red horizontal bands)
const MID_BAND_FILL = 'rgba(244,63,94,0.0)';  // Fill color with transparency
const MID_BAND_EDGE = 'rgba(244,63,94,0.7)';  // Edge color for definition
const MID_BAND_PX = 1;                         // Band thickness in pixels

// Box colors for different scenarios
const BOX_COLOR_PURPLE = { 
  fill: 'rgba(156,39,176,0.16)', 
  stroke: 'rgba(156,39,176,0.30)' 
}; // Purple theme (#9C27B0)
const BOX_COLOR_BLUE = { 
  fill: 'rgba(41,98,255,0.18)', 
  stroke: 'rgba(41,98,255,0.30)' 
}; // Blue theme (#2962ff)

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Groups scenario lines by outcome type (LONG_TRUE, LONG_FALSE, etc.)
 */
function groupLinesByOutcome(lines: { name:string; value:number; style?:string; color?:string }[]) {
  const out: Record<Exclude<OutcomeKey,'NONE'|'AUTO'>, { pct:number; dashed:boolean; color:string }[]> = {
    LONG_TRUE: [], LONG_FALSE: [], SHORT_TRUE: [], SHORT_FALSE: [],
  };
  for (const l of lines || []) {
    const name = (l.name || '').toUpperCase();
    const pct = +l.value; if (!Number.isFinite(pct)) continue;
    const dashed = (l.style || '').toLowerCase() === 'dashed';
    const color = l.color || (name.startsWith('LONG') ? '#2563eb' : '#dc2626');
    if (name.startsWith('LONG_TRUE')) out.LONG_TRUE.push({ pct, dashed, color });
    else if (name.startsWith('LONG_FALSE')) out.LONG_FALSE.push({ pct, dashed, color });
    else if (name.startsWith('SHORT_TRUE')) out.SHORT_TRUE.push({ pct, dashed, color });
    else if (name.startsWith('SHORT_FALSE')) out.SHORT_FALSE.push({ pct, dashed, color });
  }
  Object.values(out).forEach(arr => arr.sort((a,b)=>a.pct-b.pct));
  return out;
}

function outcomeForRange(
  range: { startTime: UTCTimestamp; endTime: UTCTimestamp; high:number; low:number },
  bars: Candle[]
): OutcomeKey {
  let confirmed: 'LONG_TRUE'|'SHORT_TRUE'|null = null;
  for (const b of bars) {
    const t = b.time as number;
    if (t < (range.startTime as number) || t >= (range.endTime as number)) continue;
    if (!confirmed) {
      if (b.close > range.high) confirmed = 'LONG_TRUE';
      else if (b.close < range.low) confirmed = 'SHORT_TRUE';
    } else {
      if (confirmed === 'LONG_TRUE' && b.close < range.low)  return 'LONG_FALSE';
      if (confirmed === 'SHORT_TRUE' && b.close > range.high) return 'SHORT_FALSE';
    }
  }
  return confirmed ?? 'NONE';
}

function levelIndexMap(lines: ScenarioLine[]) {
  const out: Record<number, { pct: number }> = {};
  for (const l of (lines || [])) {
    const m = /_(\d+)$/.exec(l.name || '');
    if (!m) continue;
    const idx = +m[1]; const pct = +l.value;
    if (Number.isFinite(pct)) out[idx] = { pct };
  }
  return out;
}

// snap mid time to the closest bar time (so coordinates always resolve)
function quarterMidTime(t1: UTCTimestamp, t2: UTCTimestamp, bars: { time: UTCTimestamp }[]) {
  const target = (((t1 as number) + (t2 as number)) / 2) | 0;
  if (!bars?.length) return t2;
  let lo = 0, hi = bars.length - 1, best = 0, bestd = Infinity;
  while (lo <= hi) {
    const m = (lo + hi) >> 1, tm = bars[m].time as number, d = Math.abs(tm - target);
    if (d < bestd) { bestd = d; best = m; }
    if (tm < target) lo = m + 1; else hi = m - 1;
  }
  return bars[best].time;
}

function quarterLeftTime(t1: UTCTimestamp, bars: { time: UTCTimestamp }[], offsetBars = 2) {
  if (!bars?.length) return t1;
  const t1n = t1 as number;
  let i = 0;
  while (i < bars.length && (bars[i].time as number) < t1n) i++;
  i = Math.min(bars.length - 1, i + Math.max(0, offsetBars)); // step inside the quarter a bit
  return bars[i].time;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ChartPanel({ data, symbol, onQuarterLevels, selectedModel, selectedOutcome, overlaySymbol, overlayLevels }: { 
  data: Candle[]; 
  symbol?: string; 
  onQuarterLevels?: (l:{upper20:number;upper50:number;upper80:number;lower20:number;lower50:number;lower80:number})=>void;
  selectedModel?: 'simple' | 'pro' | 'overlay';
  selectedOutcome?: OutcomeKey;
  overlaySymbol?: string | null;
  overlayLevels?: any;
}) {
  // ============================================================================
  // REFS AND STATE
  // ============================================================================
  
  // Chart core refs
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const requestTokenRef = useRef(0);
  const disposedRef = useRef(false);

  // Virtualized line-series pool for performance
  const POOL_SIZE = 2000; // even more headroom for many quarters × levels
  const poolRef = useRef<ISeriesApi<'Line'>[]>([]);
  const mapRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const lastVisibleKeysRef = useRef<Set<string>>(new Set());
  const lastRangeRef = useRef<{ from: number; to: number } | null>(null);
  const allSegsRef = useRef<Seg[]>([]);
  const linesRafRef = useRef<number | undefined>(undefined);
  const boxesRafRef = useRef<number | undefined>(undefined);
  const rangesMidRef = useRef<number>(1); // Store representative mid for LOD fallback

  // Overlay canvas for custom rendering
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const boxesRef = useRef<Box[]>([]);
  const labelsRef = useRef<Label[]>([]);
  const midBandsRef = useRef<MidBand[]>([]);

  // Context menu state
  type MenuState = { open: boolean; x: number; y: number; price: number | null; time: UTCTimestamp | null };
  const [menu, setMenu] = useState<MenuState>({ open:false, x:0, y:0, price:null, time:null });

  // Log scale toggle - docked approach
  const [yMode, setYMode] = useState<'log'|'lin'>('lin'); // Default to 'lin' for SSR consistency
  const yModeRef = useRef<'log'|'lin'>('lin');
  const dockRef   = useRef<HTMLDivElement|null>(null);
  const logBtnRef = useRef<HTMLButtonElement|null>(null);

  async function ensureVisibleRangeReady(
    ts: ReturnType<ReturnType<typeof createChart>['timeScale']>
  ) {
    for (let i = 0; i < 10; i++) {
      const vr = ts.getVisibleRange();
      if (vr && Number.isFinite(+vr.from!) && Number.isFinite(+vr.to!)) return;
      await new Promise((r) => requestAnimationFrame(r));
    }
  }

  function showLastNBars(ts: ReturnType<ReturnType<typeof createChart>['timeScale']>, data: { time: number }[], N = 300) {
    if (!data?.length) return;
    const last = data.length - 1;
    const fromIdx = Math.max(0, last - (N - 1));
    ts.setVisibleRange({ from: (data[fromIdx].time as any), to: (data[last].time as any) });
    ts.scrollToRealTime();
  }

  function defaultBarsFor(data: { time: number }[]) {
    if (!data?.length) return 0;
    if (data.length < 3) return data.length;
    const last = data.length - 1;
    const window = Math.min(200, last);
    const dt = (data[last].time as number) - (data[last - window].time as number);
    const avgSec = dt / window;
    if (avgSec <= 3600) return 400;        // intraday ≤1h
    if (avgSec <= 6 * 3600) return 220;    // 1–6h
    return 220;                             // daily+ (reduced from 250)
  }

  // --- Boxes helpers ---
  function pairSymmetric(levels: PctLine[], prefer: number[] = []): Array<[number, number]> {
    const byAbs = new Map<number, { pos?: number; neg?: number }>();
    for (const { pct } of levels || []) {
      const abs = Math.abs(pct);
      const slot = byAbs.get(abs) ?? (byAbs.set(abs, {}), byAbs.get(abs)!);
      if (pct >= 0) slot.pos = pct; else slot.neg = pct;
    }
    const xs = Array.from(byAbs.keys()).sort((a,b)=>a-b);
    const order = [...prefer.filter(x => byAbs.has(x)), ...xs.filter(x => !prefer.includes(x))];
    const out: Array<[number, number]> = [];
    for (const x of order) {
      const slot = byAbs.get(x)!;
      if (slot.pos != null && slot.neg != null) out.push([slot.neg!, slot.pos!]);
    }
    return out;
  }

  function buildBoxes(
    ranges: BoxRange[],
    levelSets: Record<string, PctLine[]>,
    scenarioOf: (qIndex: number) => 'LONG_TRUE'|'LONG_FALSE'|'SHORT_TRUE'|'SHORT_FALSE'|'NONE'
  ): Box[] {
    const colors = {
      LONG_TRUE:  { fill: 'rgba(59,130,246,0.18)', stroke: 'rgba(59,130,246,0.85)' },
      LONG_FALSE: { fill: 'rgba(99,102,241,0.16)', stroke: 'rgba(99,102,241,0.70)' },
      SHORT_TRUE: { fill: 'rgba(239,68,68,0.16)',  stroke: 'rgba(239,68,68,0.80)' },
      SHORT_FALSE:{ fill: 'rgba(168,85,247,0.16)', stroke: 'rgba(168,85,247,0.75)' },
    } as const;

    const wanted: number[] = [2.5, 5, 7.5, 10];
    const out: Box[] = [];

    ranges.forEach((r, i) => {
      const scenario = scenarioOf(i);
      if (scenario === 'NONE') return;
      const levels = levelSets[scenario] ?? [];
      const bands = pairSymmetric(levels, wanted);
      for (const [neg, pos] of bands) {
        const pLow = r.mid * (1 + neg/100);
        const pHigh = r.mid * (1 + pos/100);
        const c = colors[scenario];
        out.push({ t1: r.t1, t2: r.t2, pLow, pHigh, fill: c.fill, stroke: c.stroke });
      }
    });
    return out;
  }

  function snapBandsToBars(bands: MidBand[], bars: { time: UTCTimestamp }[]): MidBand[] {
    if (!bands?.length || !bars?.length) return [];
    const times = bars.map(b => b.time as number);

    const lb = (x:number) => { let lo=0, hi=times.length; while (lo<hi){ const m=(lo+hi)>>>1; if (times[m]<x) lo=m+1; else hi=m; } return lo; };
    const ub = (x:number) => { let lo=0, hi=times.length; while (lo<hi){ const m=(lo+hi)>>>1; if (times[m]<=x) lo=m+1; else hi=m; } return lo; };

    const out: MidBand[] = [];
    for (const b of bands) {
      let i1 = lb(b.t1 as number);
      let i2 = ub(b.t2 as number) - 1;

      // widen 1-bar spans so we always render something
      if (i1 >= i2) { if (i1 > 0) i1 -= 1; if (i2 < i1) i2 = i1; }

      out.push({ ...b, t1: times[i1] as UTCTimestamp, t2: times[i2] as UTCTimestamp });
    }
    return out;
  }

  function snapBoxesToBars(boxes: Box[], bars: { time: UTCTimestamp }[]): Box[] {
    if (!boxes?.length || !bars?.length) return [];
    const times = bars.map(b => b.time as number);
    const lb = (x:number) => { let lo=0, hi=times.length; while(lo<hi){const m=(lo+hi)>>>1; if(times[m]<x) lo=m+1; else hi=m;} return lo; };
    const ub = (x:number) => { let lo=0, hi=times.length; while(lo<hi){const m=(lo+hi)>>>1; if(times[m]<=x) lo=m+1; else hi=m;} return lo; };
    const out: Box[] = [];
    for (const b of boxes) {
      let i1 = lb(b.t1 as number);
      let i2 = ub(b.t2 as number) - 1;
      if (i1 >= i2) { if (i1>0) i1--; if (i2<i1) i2=i1; }
      out.push({ ...b, t1: times[i1] as UTCTimestamp, t2: times[i2] as UTCTimestamp });
    }
    return out;
  }

  // Build bands from available percents without requiring symmetric pairs
  function buildBandsFromPcts(pcts: number[], preferred: number[] = [2.5,5,7.5,10]) {
    const pos = (pcts || []).filter(p=>p>0).sort((a,b)=>a-b);
    const neg = (pcts || []).filter(p=>p<0).map(Math.abs).sort((a,b)=>a-b);
    const posSet = new Set(pos.map(x=>+x.toFixed(6)));
    const negSet = new Set(neg.map(x=>+x.toFixed(6)));
    const all = Array.from(new Set([...preferred, ...pos, ...neg])).sort((a,b)=>a-b);
    const bands: Array<{lowPct:number, highPct:number}> = [];
    for (const x of all) {
      const hasPos = posSet.has(+x.toFixed(6));
      const hasNeg = negSet.has(+x.toFixed(6));
      if (hasPos && hasNeg) bands.push({ lowPct: -x, highPct: +x });
      else if (hasPos)      bands.push({ lowPct: 0,   highPct: +x });
      else if (hasNeg)      bands.push({ lowPct: -x,  highPct: 0   });
    }
    return bands;
  }

  function buildBoxesForRanges(
    ranges: BoxRange[],
    pctsPerQuarter: number[][],
    colors: { fill: string; stroke: string }
  ): Box[] {
    const out: Box[] = [];
    for (let i = 0; i < ranges.length; i++) {
      const r = ranges[i];
      const bands = buildBandsFromPcts(pctsPerQuarter[i] ?? []);
      for (const b of bands) {
        const pLow  = r.mid * (1 + b.lowPct/100);
        const pHigh = r.mid * (1 + b.highPct/100);
        out.push({ t1: r.t1, t2: r.t2, pLow, pHigh, fill: colors.fill, stroke: colors.stroke });
      }
    }
    return out;
  }

  // --- Scenario parsing (fixed indices) and box builder from pairs ---
  type ScenarioLine = { name: string; value: number; style?: 'solid'|'dashed'; color?: string };

  function parseScenarioFixed(lines: ScenarioLine[]) {
    const byIdx: Record<number, { pct:number; style:'solid'|'dashed'; color:string }> = {};
    for (const l of lines || []) {
      const m = /_(\d+)$/.exec(l.name || '');
      if (!m) continue;
      const idx = +m[1];
      const pct = +l.value;
      if (!Number.isFinite(pct)) continue;
      byIdx[idx] = {
        pct,
        style: ((l.style || 'solid').toLowerCase() === 'dashed' ? 'dashed' : 'solid'),
        color: l.color || '#111827',
      };
    }

    let mid = byIdx[5];
    if (!mid) {
      let bestIdx = -1, bestAbs = Infinity;
      for (const k in byIdx) {
        const idx = +k, abs = Math.abs(byIdx[idx].pct);
        if (abs < bestAbs) { bestAbs = abs; bestIdx = idx; }
      }
      mid = bestIdx > 0 ? byIdx[bestIdx] : { pct: 0, style: 'solid', color: '#111827' } as const;
    }

    const WANT: [number, number][] = [[1,2],[3,4],[6,7],[8,9]];
    const pairs: [number, number][] = [];
    for (const [a,b] of WANT) {
      if (byIdx[a] && byIdx[b]) {
        const lo = Math.min(byIdx[a].pct, byIdx[b].pct);
        const hi = Math.max(byIdx[a].pct, byIdx[b].pct);
        pairs.push([lo, hi]);
      }
    }

    return { midPct: mid.pct, midStyle: mid.style, midColor: mid.color, pairs };
  }

  function boxesFromPairs(
    range: { t1: UTCTimestamp; t2: UTCTimestamp; mid: number },
    pairs: [number, number][]
  ): Box[] {
    // index 0 -> (1–2), index 1 -> (3–4), index 2 -> (6–7), index 3 -> (8–9)
    const colorsByIndex = [
      BOX_COLOR_PURPLE, // 1–2
      BOX_COLOR_PURPLE, // 3–4
      BOX_COLOR_BLUE,   // 6–7
      BOX_COLOR_BLUE,   // 8–9
    ];

    const out: Box[] = [];
    for (let i = 0; i < pairs.length; i++) {
      const [loPct, hiPct] = pairs[i];
      const yLo = range.mid * (1 + loPct / 100);
      const yHi = range.mid * (1 + hiPct / 100);
      const { fill, stroke } = colorsByIndex[Math.min(i, colorsByIndex.length - 1)];
      out.push({
        t1: range.t1,
        t2: range.t2,
        pLow: Math.min(yLo, yHi),
        pHigh: Math.max(yLo, yHi),
        fill,
        stroke,
      });
    }
    return out;
  }

  // Keep-name grouper for scenario lines
  function groupScenarioLines(lines: ScenarioLine[]) {
    const out: Record<Exclude<OutcomeKey,'NONE'|'AUTO'>, ScenarioLine[]> = {
      LONG_TRUE: [], LONG_FALSE: [], SHORT_TRUE: [], SHORT_FALSE: [],
    };
    for (const l of lines || []) {
      const upper = (l.name || '').toUpperCase();
      if (upper.startsWith('LONG_TRUE')) out.LONG_TRUE.push(l);
      else if (upper.startsWith('LONG_FALSE')) out.LONG_FALSE.push(l);
      else if (upper.startsWith('SHORT_TRUE')) out.SHORT_TRUE.push(l);
      else if (upper.startsWith('SHORT_FALSE')) out.SHORT_FALSE.push(l);
      // Handle simple model naming (Long_Low_10, Long_High_10, Short_Low_10, Short_High_10)
      else if (upper.startsWith('LONG_')) out.LONG_TRUE.push(l); // Simple model only has one Long scenario
      else if (upper.startsWith('SHORT_')) out.SHORT_TRUE.push(l); // Simple model only has one Short scenario
    }
    (Object.keys(out) as (keyof typeof out)[]).forEach((key) => {
      out[key].sort((a,b) => {
        const ai = +((/_(\d+)$/.exec(a.name || '') || [])[1] || NaN);
        const bi = +((/_(\d+)$/.exec(b.name || '') || [])[1] || NaN);
        return (ai || 0) - (bi || 0);
      });
    });
    return out;
  }

  function lowerBound(arr: number[], x: number) {
    let lo = 0, hi = arr.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (arr[mid] < x) lo = mid + 1; else hi = mid; }
    return lo;
  }
  function upperBound(arr: number[], x: number) {
    let lo = 0, hi = arr.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (arr[mid] <= x) lo = mid + 1; else hi = mid; }
    return lo;
  }
  function snapSegmentsToBars(segs: Seg[], bars: Candle[]): Seg[] {
    if (!bars.length) return [];
    const times = bars.map(b => b.time as number);
    const out: Seg[] = [];
    for (const s of segs) {
      const i1 = lowerBound(times, s.t1 as number);
      const i2 = upperBound(times, s.t2 as number) - 1;
      if (i1 < 0 || i2 < 0 || i1 >= times.length || i2 >= times.length || i1 >= i2) continue;
      out.push({ ...s, t1: times[i1] as UTCTimestamp, t2: times[i2] as UTCTimestamp });
    }
    return out;
  }

  function buildSegments(ranges: RangeLite[], levelPcts: number[]): Seg[] {
    const DAY = 24 * 60 * 60;
    const out: Seg[] = [];
    for (const r of ranges) {
      const t1 = ((r.startTime as number) + DAY) as UTCTimestamp;
      const t2 = ((r.endTime as number) - DAY) as UTCTimestamp;
      if ((t1 as number) >= (t2 as number)) continue;
      for (const p of levelPcts) {
        out.push({
          t1,
          t2,
          v: r.mid * (1 + p / 100),
          pct: p,
          color: p === 0 ? '#111827' : p > 0 ? '#16a34a' : '#ef4444',
          w: p === 0 ? 2 : 1,
          dashed: p === 0,
        });
      }
    }
    return out.sort((a, b) => (a.t1 as number) - (b.t1 as number));
  }

  function seriesKey(s: Seg) { return `${s.v.toFixed(6)}@${s.t1}-${s.t2}`; }

  function ensurePool(chart: ReturnType<typeof createChart> | null) {
    if (!chart) return;
    while (poolRef.current.length + mapRef.current.size < POOL_SIZE) {
      const s = chart.addLineSeries({
        color: '#111827',
        lineWidth: 1,
        lineType: LineType.Simple,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      });
      poolRef.current.push(s);
    }
  }

  // change the type you pass to acquireSeries
  type LineSty = { color: string; w: number; style?: 'solid'|'dotted'|'dashed' };

  function acquireSeries(sty: LineSty) {
    const chart = chartRef.current; if (!chart) return null;
    ensurePool(chart);
    const s = poolRef.current.pop() ?? chart.addLineSeries();
    s.applyOptions({
      color: sty.color,
      lineWidth: sty.w as any,
      lineStyle: sty.style === 'dashed' ? 2 : sty.style === 'dotted' ? 1 : 0, // 0 solid, 1 dotted, 2 dashed
      lineType: LineType.Simple,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    return s;
  }

  // when acquiring a line series for levels
  function acquireLevelSeries(style: { color: string; w: number; lineStyle: 0|1|2 }) {
    const chart = chartRef.current!;
    ensurePool(chart);

    const s = poolRef.current.pop() ?? chart.addLineSeries({
      priceScaleId: 'right',           // keep on right scale so coordinates match candles
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });

    s.applyOptions({
      color: style.color,
      lineWidth: style.w as any,
      lineStyle: style.lineStyle,      // 0 solid, 1 dotted, 2 dashed
      // KEY: exclude this series from autoscale math
      autoscaleInfoProvider: () => ({
        priceRange: {
          minValue: Number.POSITIVE_INFINITY,
          maxValue: Number.NEGATIVE_INFINITY,
        },
        margins: { above: 0, below: 0 },
      }),
    });

    return s;
  }

  function releaseSeries(key: string) {
    const s = mapRef.current.get(key);
    if (!s) return;
    s.setData([]);
    poolRef.current.push(s);
    mapRef.current.delete(key);
  }

  function releaseAllVisible() {
    for (const key of Array.from(mapRef.current.keys())) {
      releaseSeries(key);
    }
  }

  function pickLODPcts(all: number[], visibleBarsApprox: number) {
    if (visibleBarsApprox > 2000) return [ -50, -25, 0, 25, 50 ];
    if (visibleBarsApprox > 800)  return [ -50, -25, -10, 0, 10, 25, 50 ];
    return all;
  }

  function estimateVisibleBars(ts: ReturnType<ReturnType<typeof createChart>['timeScale']>) {
    const lr = ts.getVisibleLogicalRange();
    if (!lr) return 500;
    return Math.max(2, Math.floor((lr.to as number) - (lr.from as number)));
  }

  function scheduleVisibleRender() {
    if (linesRafRef.current != null) cancelAnimationFrame(linesRafRef.current);
    linesRafRef.current = requestAnimationFrame(() => {
      linesRafRef.current = undefined;
      renderVisibleDiff();
    });
  }

  function scheduleDraw() {
    if (boxesRafRef.current != null) cancelAnimationFrame(boxesRafRef.current);
    boxesRafRef.current = requestAnimationFrame(() => {
      boxesRafRef.current = undefined;
      drawBoxes();
      positionDock(); // reposition dock after each draw to keep it perfect
    });
  }

  function drawBoxes() {
    if (!overlayRef.current || !chartRef.current || !seriesRef.current) return;
    const cv = overlayRef.current;
    const chart = chartRef.current;
    const series = seriesRef.current;

    const dpr = window.devicePixelRatio || 1;
    const w = hostRef.current!.clientWidth;
    const h = hostRef.current!.clientHeight;

    if (cv.width !== Math.round(w*dpr) || cv.height !== Math.round(h*dpr)) {
      cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr);
      cv.style.width = `${w}px`;    cv.style.height = `${h}px`;
    }

    const ctx = cv.getContext('2d')!;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,w,h);

    // clip to plot area (exclude right price scale and bottom time axis)
    const rightW = chart.priceScale('right')?.width?.() ?? 0;
    const timeH  = chart.timeScale()?.height?.() ?? 0;
    const paneW  = Math.max(0, w - rightW);
    const paneH  = Math.max(0, h - timeH);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, paneW, paneH);
    ctx.clip();

    const ts = chart.timeScale();
    const vr = ts.getVisibleRange(); if (!vr) { ctx.restore(); return; }

    // Draw boxes
    for (const bx of boxesRef.current) {
      if ((bx.t2 as number) < (vr.from as number) || (bx.t1 as number) > (vr.to as number)) continue;

      const x1 = ts.timeToCoordinate(bx.t1);
      const x2 = ts.timeToCoordinate(bx.t2);
      const y1 = series.priceToCoordinate(bx.pHigh);
      const y2 = series.priceToCoordinate(bx.pLow);
      if (x1 == null || x2 == null || y1 == null || y2 == null) continue;

      drawBox(ctx, x1, y1, x2, y2, bx.fill, bx.stroke);
    }

    // ---- draw mid bands (red)
    for (const mb of midBandsRef.current) {
      if ((mb.t2 as number) < (vr.from as number) || (mb.t1 as number) > (vr.to as number)) continue;

      const x1 = ts.timeToCoordinate(mb.t1);
      const x2 = ts.timeToCoordinate(mb.t2);
      const y  = series.priceToCoordinate(mb.price);
      if (x1 == null || x2 == null || y == null) continue;

      let left  = Math.min(x1, x2);
      let right = Math.max(x1, x2);
      // ensure a minimum width so very short quarters still show
      if (right - left < 2) right = left + 2;

      const top = (y as number) - MID_BAND_PX / 2;
      const h   = Math.max(1, MID_BAND_PX);

      // fill
      ctx.fillStyle = MID_BAND_FILL;
      ctx.fillRect(Math.round(left), Math.round(top), Math.round(right - left), Math.round(h));

      // darker top/bottom edges for readability
      ctx.strokeStyle = MID_BAND_EDGE;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(Math.round(left) + 0.5, Math.round(top) + 0.5);
      ctx.lineTo(Math.round(right) - 0.5, Math.round(top) + 0.5);
      ctx.moveTo(Math.round(left) + 0.5, Math.round(top + h) - 0.5);
      ctx.lineTo(Math.round(right) - 0.5, Math.round(top + h) - 0.5);
      ctx.stroke();
    }

    // --- labels (draw after boxes, inside the plot-area clip) ---
    ctx.font = `bold 10px Inter, system-ui, -apple-system, Segoe UI, Roboto`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    const labelTs = chart.timeScale();
    const labelVr = labelTs.getVisibleRange();
    const labelRightW = chart.priceScale('right')?.width?.() ?? 0;
    const labelTimeH  = chart.timeScale()?.height?.() ?? 0;
    const plotW  = Math.max(0, w - labelRightW);
    const plotH  = Math.max(0, h - labelTimeH);

    const EDGE_MARGIN = 12;   // cut labels too close to pane edges
    const X_INSET     = 8;    // inset from left edge of quarter
    const PAD         = 3;    // bbox padding to avoid overlaps
    const TEXT_H      = 12;   // approximate text height (matches font px)

    // Collect visible candidates with coordinates
    type Cand = { x:number; y:number; text:string; color:string };
    const cands: Cand[] = [];
    for (const lb of labelsRef.current) {
      if (!labelVr || (lb.t as number) < (labelVr.from as number) || (lb.t as number) > (labelVr.to as number)) continue;
      const x0 = labelTs.timeToCoordinate(lb.t);
      const yLine = series.priceToCoordinate(lb.price);
      if (x0 == null || yLine == null) continue;

      const y = (yLine as number) + (lb.dy || 0);
      if (y < EDGE_MARGIN || y > plotH - EDGE_MARGIN) continue;

      let x = (x0 as number) + (lb.dx ?? X_INSET);
      x = Math.max(6, Math.min(x, plotW - 6));

      cands.push({ x, y, text: lb.text, color: lb.color });
    }

    // Sort left-to-right then top-to-bottom for stable placement
    cands.sort((a,b) => (a.x - b.x) || (a.y - b.y));

    // Place with 2D collision rejection
    type Rect = { x:number; y:number; w:number; h:number };
    const placed: { rect: Rect; c: Cand }[] = [];
    const intersects = (a:Rect, b:Rect, pad=PAD) =>
      !(a.x + a.w + pad < b.x || b.x + b.w + pad < a.x || a.y + a.h + pad < b.y || b.y + b.h + pad < a.y);

    for (const c of cands) {
      const tw = Math.ceil(ctx.measureText(c.text).width);
      const rect: Rect = { x: Math.round(c.x), y: Math.round(c.y - TEXT_H/2), w: tw, h: TEXT_H };

      // keep inside pane vertically
      if (rect.y < EDGE_MARGIN || rect.y + rect.h > plotH - EDGE_MARGIN) continue;

      // skip if collides with any already-placed label
      if (placed.some(p => intersects(p.rect, rect))) continue;

      placed.push({ rect, c });
    }

    // Draw
    for (const { rect, c } of placed) {
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, rect.x, rect.y + TEXT_H/2);
    }

    ctx.restore();
  }

  // util: darken a hex or rgba color a bit
  function darkenColor(c: string, factor = 0.75, alpha = 1): string {
    const mHex = /^#([0-9a-f]{6})$/i.exec(c);
    if (mHex) {
      const n = parseInt(mHex[1], 16);
      const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      const R = Math.round(r * factor), G = Math.round(g * factor), B = Math.round(b * factor);
      return `rgba(${R},${G},${B},${alpha})`;
    }
    const mRgba = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/i.exec(c);
    if (mRgba) {
      const r = +mRgba[1], g = +mRgba[2], b = +mRgba[3];
      const a = mRgba[4] != null ? +mRgba[4] : 1;
      const R = Math.round(r * factor), G = Math.round(g * factor), B = Math.round(b * factor);
      return `rgba(${R},${G},${B},${Math.min(1, a * alpha)})`;
    }
    // fallback
    return c;
  }

  /** Draws a filled box with dark, thicker top/bottom borders (and no left/right borders) */
  function drawBox(
    ctx: CanvasRenderingContext2D,
    x1: number, yTop: number,
    x2: number, yBot: number,
    fill: string, stroke: string
  ) {
    const left = Math.min(x1, x2), right = Math.max(x1, x2);
    const top  = Math.min(yTop, yBot), bottom = Math.max(yTop, yBot);
    const w = Math.max(1, Math.round(right - left));
    const h = Math.max(1, Math.round(bottom - top));

    // fill
    ctx.fillStyle = fill;
    ctx.fillRect(Math.round(left), Math.round(top), w, h);

    // thicker/darker top & bottom borders (pixel-snapped for crispness)
    const edge = darkenColor(stroke, 0.72, 1); // slightly darker than stroke
    ctx.strokeStyle = edge;
    ctx.lineCap = 'butt';

    // choose thickness (retina-safe) — tweak 1 or 2 if you want bolder
    const thick = 1;
    ctx.lineWidth = thick;

    // top
    ctx.beginPath();
    ctx.moveTo(Math.round(left) + 0.5, Math.round(top) + 0.5);
    ctx.lineTo(Math.round(left + w) - 0.5, Math.round(top) + 0.5);
    ctx.stroke();

    // bottom
    ctx.beginPath();
    ctx.moveTo(Math.round(left) + 0.5, Math.round(top + h) - 0.5);
    ctx.lineTo(Math.round(left + w) - 0.5, Math.round(top + h) - 0.5);
    ctx.stroke();

    // (optional) super-subtle left/right edges
    // ctx.lineWidth = 1;
    // ctx.strokeStyle = darkenColor(stroke, 0.9, 0.25);
    // ctx.beginPath();
    // ctx.moveTo(Math.round(left) + 0.5, Math.round(top) + 0.5);
    // ctx.lineTo(Math.round(left) + 0.5, Math.round(top + h) - 0.5);
    // ctx.moveTo(Math.round(left + w) - 0.5, Math.round(top) + 0.5);
    // ctx.lineTo(Math.round(left + w) - 0.5, Math.round(top + h) - 0.5);
    // ctx.stroke();
  }

  function applyYMode(mode: 'log'|'lin') {
    const chart = chartRef.current; if (!chart) return;
    chart.priceScale('right').applyOptions({
      mode: mode === 'log' ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
      autoScale: true,
    });
  }

  function toggleYMode() {
    const newMode = yModeRef.current === 'log' ? 'lin' : 'log';
    yModeRef.current = newMode;
    setYMode(newMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('chart:yMode', newMode);
    }
    if (logBtnRef.current) logBtnRef.current.textContent = (newMode === 'log' ? 'LOG' : 'LIN');
    applyYMode(newMode);
    positionDock(); // the price-scale width can change slightly when mode flips
  }

  function positionDock() {
    const chart = chartRef.current;
    const dock  = dockRef.current;
    const btn   = logBtnRef.current;
    if (!chart || !dock || !btn) return;
    
    const rightW = chart.priceScale('right')?.width?.() ?? 0;
    const timeH  = chart.timeScale()?.height?.() ?? 0;
    
    // Set dock to fill the entire corner square
    dock.style.width  = `${rightW}px`;
    dock.style.height = `${timeH}px`;
    
    // Position button at center of the dock (50% width of y-axis, 50% height of x-axis)
    btn.style.position = 'absolute';
    btn.style.left = '50%';
    btn.style.top = '50%';
    btn.style.transform = 'translate(-50%, -50%)';
    btn.style.width = `${rightW}px`; // Button width = y-axis width
    btn.style.height = 'auto'; // Auto height to maintain aspect ratio
  }

  function resetView() {
    const chart = chartRef.current, s = seriesRef.current;
    if (!chart || !s || !data?.length) return;
    // re-enable autoscale on price scale
    (chart.priceScale('right') as any)?.applyOptions?.({ autoScale: true });
    (s.priceScale() as any)?.applyOptions?.({ autoScale: true });
    const ts = chart.timeScale();
    const last = data.length - 1;
    const N = 300; // or defaultBarsFor(data)
    const from = data[Math.max(0, last - (N - 1))].time as any;
    const to   = data[last].time as any;
    ts.setVisibleRange({ from, to });
    ts.scrollToRealTime();
    requestAnimationFrame(() => { lastRangeRef.current = null; renderVisibleDiff(); drawBoxes(); });
  }

  function resetAxesToCandles() {
    const chart  = chartRef.current;
    const series = seriesRef.current;   // your candlestick series
    if (!chart || !series) return;

    // ensure the Y axis is computed from candles
    series.priceScale().applyOptions({ autoScale: true } as any);
    chart.priceScale('right').applyOptions({ autoScale: true });

    // nudge time scale so the library recomputes the range now
    chart.timeScale().scrollToRealTime();
  }

  function renderVisibleDiff() {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    const ts = chart.timeScale();
    const vr = ts.getVisibleRange();
    if (!vr) return;

    const cur = { from: +(vr.from as number), to: +(vr.to as number) };
    const prev = lastRangeRef.current;
    if (prev && Math.abs(cur.from - prev.from) < 1 && Math.abs(cur.to - prev.to) < 1) return;
    lastRangeRef.current = cur;

    const nowVisible: Seg[] = allSegsRef.current
      .filter(s => (s.t2 as number) >= cur.from && (s.t1 as number) <= cur.to);

    const nextKeys = new Set<string>();
    for (const s of nowVisible) nextKeys.add(seriesKey(s));

    for (const key of lastVisibleKeysRef.current) {
      if (!nextKeys.has(key)) releaseSeries(key);
    }

    for (const s of nowVisible) {
      const key = seriesKey(s);
      if (mapRef.current.has(key)) continue;
      const ls = acquireLevelSeries({ 
        color: s.color, 
        w: s.w, 
        lineStyle: s.style === 'dashed' ? 2 : s.style === 'dotted' ? 1 : 0 
      });
      if (!ls) break;
      ls.setData([{ time: s.t1, value: s.v }, { time: s.t2, value: s.v }]);
      mapRef.current.set(key, ls);
    }

    lastVisibleKeysRef.current = nextKeys;
  }

  // overlay canvas code removed in favor of virtualized line series

  // Mount chart once
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cleanup: (() => void) | null = null;

    // Small delay to ensure container is properly sized
    const timer = setTimeout(() => {
      if (!hostRef.current) return;
      const el = hostRef.current;

      // Ensure we have proper dimensions
      const rect = el.getBoundingClientRect();
      const width = Math.max(rect.width || 800, 400);
      const height = Math.max(rect.height || 400, 300);

      console.log('ChartPanel: Container dimensions', { width, height, rect });

      const chart = createChart(el, {
        width,
        height,
        layout: { background: { color: '#fff' }, textColor: '#111827', fontFamily: 'Inter, system-ui' },
        grid: { vertLines: { color: '#eef2f7' }, horzLines: { color: '#eef2f7' } },
        rightPriceScale: { borderColor: '#e5e7eb', scaleMargins: { top: 0.15, bottom: 0.10 } },
        timeScale: { borderColor: '#e5e7eb', rightOffset: 10, barSpacing: 8, timeVisible: true },
        crosshair: { mode: 0 },
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
        handleScale: {
          mouseWheel: true,
          pinch: true,
          axisPressedMouseMove: { price: true, time: true },
          axisDoubleClickReset: { price: true, time: true },
        },
      });

      const series = chart.addCandlestickSeries({
        upColor: '#16a34a',
        downColor: '#000000',
        wickUpColor: '#9ca3af',
        wickDownColor: '#9ca3af',
        borderVisible: false,
        priceLineVisible: false,
      });

      chartRef.current = chart;
      seriesRef.current = series;
      disposedRef.current = false;

      const ro = new ResizeObserver(([entry]) => {
        const { width: roWidth, height: roHeight } = entry.contentRect;
        if (!chartRef.current || disposedRef.current) return;
        try {
          chart.resize(Math.max(0, Math.floor(roWidth)), Math.max(0, Math.floor(roHeight)));
        } catch {
          /* resize can fire after dispose */
        }
        scheduleVisibleRender();
      });
      ro.observe(el);

      const ts = chart.timeScale();
      const onVisibleRange = () => { scheduleVisibleRender(); scheduleDraw(); };
      ts.subscribeVisibleTimeRangeChange(onVisibleRange);

      const rightPs = chart.priceScale('right');
      const onSize = () => scheduleDraw();
      (rightPs as any)?.subscribeSizeChange?.(onSize);

      const onWheel = () => scheduleDraw();
      const onMouseMove = () => scheduleDraw();
      el.addEventListener('wheel', onWheel, { passive: true } as any);
      el.addEventListener('mousemove', onMouseMove);

      const cv = document.createElement('canvas');
      cv.style.position = 'absolute';
      cv.style.inset = '0';
      cv.style.pointerEvents = 'none';
      cv.style.zIndex = '2';
      el.appendChild(cv);
      overlayRef.current = cv;

      cleanup = () => {
        disposedRef.current = true;
        (rightPs as any)?.unsubscribeSizeChange?.(onSize);
        try { ts.unsubscribeVisibleTimeRangeChange(onVisibleRange); } catch {
          /* ignore stale unsubscribe */
        }
        el.removeEventListener('wheel', onWheel);
        el.removeEventListener('mousemove', onMouseMove);
        ro.disconnect();
        cv.remove();
        if (linesRafRef.current != null) {
          cancelAnimationFrame(linesRafRef.current);
          linesRafRef.current = undefined;
        }
        if (boxesRafRef.current != null) {
          cancelAnimationFrame(boxesRafRef.current);
          boxesRafRef.current = undefined;
        }
        try { chart.remove(); } catch {
          /* ignore double dispose */
        }
        chartRef.current = null;
        seriesRef.current = null;
        overlayRef.current = null;
      };
    }, 50); // Small delay to ensure container is sized

    return () => {
      clearTimeout(timer);
      if (cleanup) {
        cleanup();
        cleanup = null;
      }
    };
  }, []);

  // Context menu handling
  useEffect(() => {
    const el = hostRef.current;
    if (!el || !chartRef.current || !seriesRef.current) return;

    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      const ts = chartRef.current!.timeScale();
      const t  = ts.coordinateToTime(localX) as UTCTimestamp | null;
      const p  = seriesRef.current!.coordinateToPrice(localY) ?? null;
      setMenu({ open: true, x: e.clientX, y: e.clientY, price: p as number | null, time: t });
    };

    const close = () => setMenu(m => ({ ...m, open:false }));
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') close(); };

    el.addEventListener('contextmenu', onContext, { capture: true } as any);
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);

    return () => {
      el.removeEventListener('contextmenu', onContext, { capture: true } as any);
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [data]);

  // Keyboard shortcut: R to reset view
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        resetView();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [data]);

  // Update data and segments when inputs change
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    if (!data?.length) { seriesRef.current.setData([]); releaseAllVisible(); allSegsRef.current = []; return; }

    (async () => {
      // clear any old lines while we recompute
      releaseAllVisible();
      allSegsRef.current = [];

      // 1) set candles + viewport, then wait for scale readiness
      seriesRef.current!.setData(data);
      const ts = chartRef.current!.timeScale();
      showLastNBars(ts, data as any, defaultBarsFor(data as any));
      await ensureVisibleRangeReady(ts);

      // reset vertical autoscale & ensure sane viewport
      (chartRef.current!.priceScale('right') as any)?.applyOptions?.({ autoScale: true });
      (seriesRef.current!.priceScale() as any)?.applyOptions?.({ autoScale: true });
      ts.scrollToRealTime();

      // 2) compute quarterly ranges from bars
      const ranges = findQuarterRanges(data as any);

      // 3) markers right away
      const markers = markersFromRanges(ranges);
      seriesRef.current!.setMarkers(markers);

      // 4) build scenario segments via API and also scenario boxes
      const token = ++requestTokenRef.current;
      let segs: Seg[] = [];
      let boxes: Box[] = [];
      labelsRef.current = [];
      midBandsRef.current = [];
      try {
        if (symbol) {
          let lines: any[] = [];
          
          // Use overlay levels if in overlay mode and overlay data is available
          if (selectedModel === 'overlay' && overlayLevels) {
            console.log('Overlay mode: using overlay levels (excluded from autoscale)');
            lines = overlayLevels?.daily?.lines ?? [];
          } else {
            // Use current symbol levels for simple/pro modes
            const res = await fetch(`/api/levels?symbol=${encodeURIComponent(symbol)}&model=${selectedModel}`, { cache: 'no-store' });
            if (requestTokenRef.current === token && res.ok) {
              const lvl: LevelsResponse = await res.json();
              lines = lvl?.daily?.lines ?? [];
            }
          }
          
          if (lines.length) {
            const groupedFull = groupScenarioLines(lines as any);
            const DAY = 24 * 60 * 60;
            // Build boxes + midline only from (1–2), (3–4), mid=5, (6–7), (8–9)
            for (let i = 0; i < ranges.length; i++) {
              const r = ranges[i];
                // Determine scenario based on model
                let scenario: OutcomeKey;
                if (selectedModel === 'simple') {
                  const detected = outcomeForRange(r as any, data);
                  // preferred scenario from price action
                  let key: 'LONG_TRUE' | 'SHORT_TRUE' | null = null;
                  if (detected.startsWith('LONG'))      key = 'LONG_TRUE';
                  else if (detected.startsWith('SHORT')) key = 'SHORT_TRUE';
                  
                  // hard fallback so we draw for ALL quarters
                  if (!key) key = groupedFull.LONG_TRUE.length ? 'LONG_TRUE'
                                                               : (groupedFull.SHORT_TRUE.length ? 'SHORT_TRUE' : null);
                  if (!key) continue; // truly no lines available in JSON (shouldn't happen)
                  
                  scenario = key;
                } else {
                  // Pro/Overlay model: use selected outcome for latest quarter, otherwise auto-detect
                  const isLatestQuarter = (i === ranges.length - 1);
                  scenario = (selectedModel === 'pro' && selectedOutcome && selectedOutcome !== 'AUTO' && isLatestQuarter) ? selectedOutcome : outcomeForRange(r as any, data);
                }

              const t1 = ((r.startTime as number) + DAY) as UTCTimestamp;
              const t2 = ((r.endTime   as number) - DAY) as UTCTimestamp;
              if ((t1 as number) >= (t2 as number)) continue;

              let midPct = 0; // default to true midpoint when scenario is NONE

              if (scenario !== 'NONE' && scenario !== 'AUTO') {
                const parsed = parseScenarioFixed(groupedFull[scenario] || []);
                midPct = Number.isFinite(parsed.midPct) ? parsed.midPct : 0;

                if (selectedModel === 'simple') {
                  // Simple model: create individual horizontal lines for each level
                  // use EVERY level in that bucket (we're not sub-selecting)
                  const scenarioLines = groupedFull[scenario] || [];
                  
                  for (const line of scenarioLines) {
                    const price = r.mid * (1 + line.value / 100);
                    
                    // Enhanced detection for line styling
                    const nameU = (line.name || '').toUpperCase();
                    
                    // robust match for "Long High 90" / "Long Low 90"
                    // works with names like LONG_HIGH_90, LONGHIGH90, LONG_LOW_9, etc.
                    const isHigh = /HIGH|UPPER/.test(nameU);
                    const isLow  = /LOW(?!ER)?|LOWER/.test(nameU);
                    const is90   = /(?:_|)(90|9)\b/.test(nameU);
                    
                    const isSpecial90 = is90 && (isHigh || isLow);
                    
                    // Simple model color scheme: highs = blue, lows = purple
                    const highColor = '#2563eb';  // blue for highs
                    const lowColor  = '#7c3aed';  // purple for lows
                    
                    let color = isHigh ? highColor : lowColor;
                    
                    // ↓ lower opacity for the two 90% lines: highs ~80%, lows ~70%
                    if (isSpecial90) {
                      const alpha = isHigh ? 0.8 : 0.7;
                      color = hexA(color, alpha);
                    }
                    
                    // thickness + stroke style
                    const width = isSpecial90 ? 2 : 1;
                    const style: 'dotted'|'dashed' = isSpecial90 ? 'dashed' : 'dotted';
                    
                    // Create horizontal line segment using the Seg type format
                    segs.push({
                      t1,
                      t2,
                      v: price, // value (price level)
                      pct: line.value, // percentage
                      color,
                      w: width,
                      // store style so acquireSeries can map it to lineStyle
                      style, // if your Seg type doesn't have it, add: style?: 'solid'|'dotted'|'dashed'
                    } as any);

                    // Add label (left side; above for highs, below for lows)
                    const pctLabel = (() => {
                      const m = /_(\d+)\b/.exec(nameU);
                      return m ? `${m[1]} %` : `${Math.round(Math.abs(line.value as number))} %`;
                    })();
                    labelsRef.current.push({
                      t: quarterLeftTime(t1, data as any, 0),
                      price: r.mid * (1 + (line.value as number)/100),
                      text: pctLabel,
                      color,
                      dy: isHigh ? -10 : 10,
                      dx: 0,
                    });
                  }
                } else {
                  // Pro/Overlay model: use boxes from (1–2), (3–4), (6–7), (8–9)
                  const bxs = boxesFromPairs({ t1, t2, mid: r.mid }, parsed.pairs);
                  boxes.push(...bxs);

                  // labels at indices 1,2,4,6,8,9 on the LEFT side
                  const idxMap = levelIndexMap(groupedFull[scenario] || []);
                  const indices = [1, 2, 3, 7, 8, 9];
                  const tLeft = quarterLeftTime(t1, data as any, 0); // a couple bars inside the quarter

                  for (const idx of indices) {
                    const e = idxMap[idx];
                    if (!e) continue;
                    const price = r.mid * (1 + e.pct / 100);
                    const isUpper = idx > 5;
                    labelsRef.current.push({
                      t: tLeft,
                      price,
                      text: LABELS_BY_INDEX[idx],
                      color: isUpper ? TEXT_BLUE : TEXT_PURPLE,
                      dy: isUpper ? -LABEL_OFFSET_PX : LABEL_OFFSET_PX,
                      dx: 0,
                    });
                  }
                }
              }

              // Add the mid band only for Pro/Overlay models (uses parsed midPct when present, else 0%)
              if (selectedModel !== 'simple') {
                const midPrice = r.mid * (1 + midPct / 100);
                midBandsRef.current.push({ t1, t2, price: midPrice });
              }
            }

            // snap boxes once
            boxes = snapBoxesToBars(boxes, data as any);

            // snap mid bands once (so timeToCoordinate never returns null)
            midBandsRef.current = snapBandsToBars(midBandsRef.current, data as any);

            // snap line segments to bar times for proper rendering when scrolling back
            segs = snapSegmentsToBars(segs, data as any);

            // emit last quarter levels exactly as plotted
            if (onQuarterLevels && ranges.length) {
              const last = ranges[ranges.length - 1];
              
              // --- SIMPLE MODEL: compute side-panel quarter levels from basic_levels.json
              if (selectedModel === 'simple' && ranges.length && lines) {
                // pick the most recent quarter
                const lastQ = ranges[ranges.length - 1];
                const basicLines = lines as Array<{ name: string; value: number }>;
                
                // Decide which bucket to use for THIS quarter
                // Use the same detection you use for drawing boxes/lines in Simple:
                const detected = outcomeForRange(lastQ as any, data);
                // "LONG_TRUE", "SHORT_TRUE", "NONE", etc.
                const prefix = detected.startsWith('SHORT') ? 'Short' : 'Long';

                // helper to find a line by name like "Long_High_20" or "Short_Low_80"
                const findPct = (name: string) =>
                  basicLines.find(l => l.name === name)?.value ?? 0;

                // compute from the MOST-RECENT quarter midpoint
                const mid = lastQ.mid; // or (lastQ.high + lastQ.low) / 2 if you don't store it
                const px = (pct: number) => +(mid * (1 + pct / 100)).toFixed(2);

                // build names based on the bucket
                const U20 = findPct(`${prefix}_High_20`);
                const U50 = findPct(`${prefix}_High_50`);
                const U80 = findPct(`${prefix}_High_80`);
                const L20 = findPct(`${prefix}_Low_20`);
                const L50 = findPct(`${prefix}_Low_50`);
                const L80 = findPct(`${prefix}_Low_80`);

                onQuarterLevels?.({
                  upper20: px(U20),
                  upper50: px(U50),
                  upper80: px(U80),
                  lower20: px(L20),
                  lower50: px(L50),
                  lower80: px(L80),
                });
              } else {
                // Pro/Overlay model: use existing logic with scenario-based levels
                // Determine scenario for quarter levels calculation
                let scenario: OutcomeKey;
                if (selectedModel === 'pro') {
                  // Pro model: use selected outcome when not AUTO, otherwise auto-detect
                  scenario = (selectedOutcome && selectedOutcome !== 'AUTO') ? selectedOutcome : outcomeForRange(last as any, data);
                } else {
                  // Overlay model: use selected outcome when not AUTO, otherwise auto-detect
                  scenario = (selectedOutcome && selectedOutcome !== 'AUTO') ? selectedOutcome : outcomeForRange(last as any, data);
                }
                
                const scenarioKey = (scenario === 'NONE' ? 'LONG_TRUE' : scenario) as Exclude<OutcomeKey,'NONE'|'AUTO'>;
                const parsed = scenario !== 'NONE' ? parseScenarioFixed(groupedFull[scenarioKey] || []) : { pairs: [], midPct: 0 } as any;
                const idxMap = levelIndexMap(groupedFull[scenarioKey] || []);
                const priceAt = (idx:number) => {
                  const e = idxMap[idx];
                  const pct = e?.pct ?? 0;
                  return +(last.mid * (1 + pct / 100)).toFixed(2);
                };
                onQuarterLevels({
                  upper20: priceAt(9),
                  upper50: priceAt(8),
                  upper80: priceAt(7),
                  lower20: priceAt(1),
                  lower50: priceAt(2),
                  lower80: priceAt(3),
                });
              }
            }
          }
        }
      } catch {}

      // 6) render segments for simple model, boxes + mid bands for pro/overlay
      if (selectedModel === 'simple') {
        // Simple model: render individual level lines only
        allSegsRef.current = segs;
        boxesRef.current = []; // Clear boxes for simple model
        releaseAllVisible();
        lastRangeRef.current = null;
        renderVisibleDiff();
        scheduleDraw(); // add this to refresh overlay/labels
      } else {
        // Pro/Overlay model: render boxes + mid bands only
        allSegsRef.current = [];
        releaseAllVisible();
        lastRangeRef.current = null;
        boxesRef.current = boxes;
        renderVisibleDiff();
        scheduleDraw();
      }
    })();
  }, [data.length, symbol, selectedModel, selectedOutcome, overlayLevels]);

  // init + keep in sync
  useEffect(() => {
    if (!chartRef.current) return;

    const safePosition = () => {
      if (!chartRef.current || disposedRef.current) return;
      positionDock();
    };

    // apply saved mode once
    applyYMode(yModeRef.current);
    // initial position
    requestAnimationFrame(safePosition);

    // update when the time scale height changes
    const ts = chartRef.current.timeScale();
    const onTsSize = () => safePosition();
    ts.subscribeSizeChange?.(onTsSize as any);

    // update on window/container resize
    const ro = new ResizeObserver(() => safePosition());
    if (hostRef.current) ro.observe(hostRef.current);
    const onWin = () => safePosition();
    window.addEventListener('resize', onWin);

    return () => {
      window.removeEventListener('resize', onWin);
      ro.disconnect();
      try { ts.unsubscribeSizeChange?.(onTsSize as any); } catch {}
    };
  }, [chartRef.current]);

  // Reset chart view when symbol changes
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current || !data?.length) return;
    requestAnimationFrame(() => resetView());
  }, [symbol]);

  // Initialize yMode from localStorage on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('chart:yMode') as 'log'|'lin' || 'lin';
      yModeRef.current = savedMode;
      setYMode(savedMode);
    }
  }, []);

  // keep dock correct after symbol change or theme/layout changes
  useEffect(() => { positionDock(); applyYMode(yModeRef.current); }, [symbol]);

  // Recycle when symbol changes fast
  useEffect(() => { releaseAllVisible(); }, [symbol]);

  // Reset axes to candlesticks only when symbol or model changes
  useEffect(() => { 
    console.log('Right scale autoscale from candles only');
    resetAxesToCandles(); 
  }, [symbol, selectedModel]);

  // keyboard shortcut (L)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'l') { e.preventDefault(); toggleYMode(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Cleanup all series on unmount
  useEffect(() => {
    return () => {
      const chart = chartRef.current;
      // hide and return all visible line series to pool, then remove all
      releaseAllVisible();
      if (chart) {
        for (const s of poolRef.current) {
          try { chart.removeSeries(s); } catch {}
        }
      }
      poolRef.current = [];
      mapRef.current.clear();
    };
  }, []);

  return <>
    <div className="chart-root relative w-full h-full" ref={hostRef}>
      {/* chart mounts here */}

      {/* Corner dock – matches the empty square (price scale × time scale) */}
      <div
        ref={dockRef}
        className="absolute z-20 pointer-events-none"
        style={{
          right: 0,
          bottom: 0,
          width:  0,   // set dynamically
          height: 0,   // set dynamically
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
        }}
      >
            <button
              ref={logBtnRef}
              onClick={() => toggleYMode()}
              className="pointer-events-auto"
              style={{
                // square; no rounding, no drop shadow – feels "integrated"
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 0,
                background: '#fff',
                fontSize: 11,
                fontWeight: 600,
                lineHeight: '18px',
                padding: '4px 8px',
                cursor: 'pointer',
                userSelect: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                // position, transform, width, height will be set dynamically in positionDock()
              }}
              title="Toggle logarithmic scale (L)"
            >
              {yMode === 'log' ? 'LOG' : 'LIN'}
            </button>
      </div>
    </div>
    {menu.open && (
      <div
        className="fixed z-50 min-w-48 rounded-none border border-gray-200 bg-white shadow-xl"
        style={{
          left: Math.min(menu.x, window.innerWidth - 220),
          top:  Math.min(menu.y, window.innerHeight - 160),
        }}
      >
        <button
          className="flex w-full items-center gap-3 px-4 py-2 hover:bg-gray-50"
          onClick={() => { resetView(); setMenu(m => ({...m, open:false})); }}
        >
          <span style={{width:16}}>↺</span>
          <span className="flex-1 text-sm">Reset chart view</span>
          <span className="text-xs text-gray-400">R</span>
        </button>

        <div className="my-1 h-px bg-gray-100" />

        <button
          className="flex w-full items-center gap-3 px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
          disabled={menu.price == null}
          onClick={async () => {
            if (menu.price == null) return;
            await navigator.clipboard.writeText(
              Number(menu.price).toLocaleString(undefined, { maximumFractionDigits: 6 })
            );
            setMenu(m => ({...m, open:false}));
          }}
        >
          <span style={{width:16}}>⧉</span>
          <span className="flex-1 text-sm">Copy price {menu.price != null ? Number(menu.price).toLocaleString(undefined, { maximumFractionDigits: 6 }) : ''}</span>
        </button>
      </div>
    )}
  </>;
}
