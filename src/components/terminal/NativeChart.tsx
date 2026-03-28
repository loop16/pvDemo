'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useTheme } from './ThemeContext';
import type { ChartTheme } from './themes';
import type {
  Bar,
  LevelLine,
  LevelSegment,
  ProbabilityBox,
  MidBand,
  ChartLabel,
  QuarterRange,
  OutcomeKey,
  VisibleRange,
} from './types';

// ============================================================================
// STATIC CONSTANTS (non-color)
// ============================================================================

const FONT = "'SF Mono', 'JetBrains Mono', 'Fira Code', ui-monospace, monospace";
const FONT_SIZE = 11;

// Mid band thickness
const MID_BAND_PX = 1;

// Label constants
const LABEL_OFFSET_PX = 10;
const LABELS_BY_INDEX: Record<number, string> = {
  1: '20 %', 2: '50 %', 3: '80 %', 7: '80 %', 8: '50 %', 9: '20 %',
};

// Layout
const MARGIN = { top: 10, right: 65, bottom: 28, left: 0 };
const MIN_VISIBLE = 10;
const MAX_VISIBLE_BARS = 2000;
const PADDING_Y = 0.08; // 8% padding above/below price range

// ============================================================================
// QUARTER DETECTION (ported from quarters.ts — no library deps)
// ============================================================================

const DAY = 24 * 60 * 60;

function quarterOf(d: Date) {
  return Math.floor(d.getUTCMonth() / 3) + 1;
}

function isFriday(ts: number) {
  return new Date(ts * 1000).getUTCDay() === 5;
}

function findQuarterRangesFromBars(bars: Bar[]): QuarterRange[] {
  if (!bars?.length) return [];
  const byQ = new Map<string, number[]>();
  bars.forEach((b, i) => {
    const d = new Date(b.time * 1000);
    const q = quarterOf(d);
    const key = `${d.getUTCFullYear()}-Q${q}`;
    if (!byQ.has(key)) byQ.set(key, []);
    byQ.get(key)!.push(i);
  });

  const qkeys = Array.from(byQ.keys()).sort();
  const ranges: QuarterRange[] = [];
  for (const key of qkeys) {
    const idxs = byQ.get(key)!;
    const firstFriIdx = idxs.find(i => isFriday(bars[i].time));
    if (firstFriIdx === undefined) continue;

    let prevIdx = Math.max(firstFriIdx - 1, idxs[0]);
    {
      const friTs = bars[firstFriIdx].time;
      const d = new Date(friTs * 1000);
      const isFirstDayOfQuarter = d.getUTCDate() === 1 && (d.getUTCMonth() % 3 === 0);
      if (isFirstDayOfQuarter && firstFriIdx > 0) {
        prevIdx = firstFriIdx - 1;
      }
    }

    const high = Math.max(bars[prevIdx].high, bars[firstFriIdx].high);
    const low = Math.min(bars[prevIdx].low, bars[firstFriIdx].low);
    const mid = (high + low) / 2;

    const thisPos = qkeys.indexOf(key);
    const hasNext = thisPos < qkeys.length - 1;
    let endTime = bars[idxs[idxs.length - 1]].time + DAY;
    if (hasNext) {
      const nextIdxs = byQ.get(qkeys[thisPos + 1])!;
      const nextFri = nextIdxs.find(i => isFriday(bars[i].time)) ?? nextIdxs[0];
      endTime = bars[nextFri].time;
    }

    let confirm: QuarterRange['confirm'] | undefined;
    let falsed: QuarterRange['falsed'] | undefined;
    for (let i = firstFriIdx + 1; i < bars.length; i++) {
      const t = bars[i].time;
      if (t >= endTime) break;
      if (!confirm) {
        if (bars[i].close > high) confirm = { side: 'LONG', time: bars[i].time };
        else if (bars[i].close < low) confirm = { side: 'SHORT', time: bars[i].time };
      } else if (!falsed) {
        if (confirm.side === 'LONG' && bars[i].close < low) falsed = { time: bars[i].time };
        if (confirm.side === 'SHORT' && bars[i].close > high) falsed = { time: bars[i].time };
      }
    }

    ranges.push({
      qkey: key,
      fridayIdx: firstFriIdx,
      prevIdx,
      startTime: bars[firstFriIdx].time,
      endTime,
      high, low, mid, confirm, falsed,
    });
  }
  return ranges;
}

function outcomeForRange(
  range: { startTime: number; endTime: number; high: number; low: number },
  bars: Bar[]
): OutcomeKey {
  let confirmed: 'LONG_TRUE' | 'SHORT_TRUE' | null = null;
  for (const b of bars) {
    if (b.time < range.startTime || b.time >= range.endTime) continue;
    if (!confirmed) {
      if (b.close > range.high) confirmed = 'LONG_TRUE';
      else if (b.close < range.low) confirmed = 'SHORT_TRUE';
    } else {
      if (confirmed === 'LONG_TRUE' && b.close < range.low) return 'LONG_FALSE';
      if (confirmed === 'SHORT_TRUE' && b.close > range.high) return 'SHORT_FALSE';
    }
  }
  return confirmed ?? 'NONE';
}

// ============================================================================
// LEVEL COMPUTATION (ported from ChartPanel.tsx)
// ============================================================================

type ScenarioLine = { name: string; value: number; style?: string; color?: string };

function hexA(hex: string, a = 1) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

function groupScenarioLines(lines: ScenarioLine[]) {
  const out: Record<Exclude<OutcomeKey, 'NONE'>, ScenarioLine[]> = {
    LONG_TRUE: [], LONG_FALSE: [], SHORT_TRUE: [], SHORT_FALSE: [],
  };
  for (const l of lines || []) {
    const upper = (l.name || '').toUpperCase();
    if (upper.startsWith('LONG_TRUE')) out.LONG_TRUE.push(l);
    else if (upper.startsWith('LONG_FALSE')) out.LONG_FALSE.push(l);
    else if (upper.startsWith('SHORT_TRUE')) out.SHORT_TRUE.push(l);
    else if (upper.startsWith('SHORT_FALSE')) out.SHORT_FALSE.push(l);
    else if (upper.startsWith('LONG_')) out.LONG_TRUE.push(l);
    else if (upper.startsWith('SHORT_')) out.SHORT_TRUE.push(l);
  }
  (Object.keys(out) as (keyof typeof out)[]).forEach(key => {
    out[key].sort((a, b) => {
      const ai = +((/_(\d+)$/.exec(a.name || '') || [])[1] || NaN);
      const bi = +((/_(\d+)$/.exec(b.name || '') || [])[1] || NaN);
      return (ai || 0) - (bi || 0);
    });
  });
  return out;
}

function levelIndexMap(lines: ScenarioLine[]) {
  const out: Record<number, { pct: number }> = {};
  for (const l of lines || []) {
    const m = /_(\d+)$/.exec(l.name || '');
    if (!m) continue;
    const idx = +m[1]; const pct = +l.value;
    if (Number.isFinite(pct)) out[idx] = { pct };
  }
  return out;
}

function parseScenarioFixed(lines: ScenarioLine[]) {
  const byIdx: Record<number, { pct: number; style: 'solid' | 'dashed'; color: string }> = {};
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
    mid = bestIdx > 0 ? byIdx[bestIdx] : { pct: 0, style: 'solid' as const, color: '#111827' };
  }

  const WANT: [number, number][] = [[1, 2], [3, 4], [6, 7], [8, 9]];
  const pairs: [number, number][] = [];
  for (const [a, b] of WANT) {
    if (byIdx[a] && byIdx[b]) {
      const lo = Math.min(byIdx[a].pct, byIdx[b].pct);
      const hi = Math.max(byIdx[a].pct, byIdx[b].pct);
      pairs.push([lo, hi]);
    }
  }

  return { midPct: mid.pct, midStyle: mid.style, midColor: mid.color, pairs };
}

/**
 * Build all level overlays from bar data, levels, and model type.
 * Returns segments (for simple model lines), boxes (for pro/beta probability rectangles),
 * midBands (pro/beta midpoint markers), and labels.
 */
function buildLevelOverlays(
  bars: Bar[],
  levels: LevelLine[],
  model: string,
  theme: ChartTheme,
  outcome?: string,
): {
  segments: LevelSegment[];
  boxes: ProbabilityBox[];
  midBands: MidBand[];
  labels: ChartLabel[];
} {
  const segments: LevelSegment[] = [];
  const boxes: ProbabilityBox[] = [];
  const midBands: MidBand[] = [];
  const labels: ChartLabel[] = [];

  if (!bars.length || !levels.length) return { segments, boxes, midBands, labels };

  const ranges = findQuarterRangesFromBars(bars);
  if (!ranges.length) return { segments, boxes, midBands, labels };

  const groupedFull = groupScenarioLines(levels as ScenarioLine[]);

  // Binary search for nearest bar index to a timestamp
  function findBarIdx(ts: number): number {
    let lo = 0, hi = bars.length - 1, best = 0, bestD = Infinity;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      const d = Math.abs(bars[m].time - ts);
      if (d < bestD) { bestD = d; best = m; }
      if (bars[m].time < ts) lo = m + 1; else hi = m - 1;
    }
    return best;
  }

  function quarterLeftIdx(startTime: number, offsetBars = 0): number {
    let i = findBarIdx(startTime);
    i = Math.min(bars.length - 1, i + offsetBars);
    return i;
  }

  const isProLikeModel = model === 'pro' || model === 'beta';

  for (let qi = ranges.length - 1; qi >= 0; qi--) {
    const r = ranges[qi];
    const isLatestQuarter = qi === ranges.length - 1;

    // Determine scenario
    let scenario: OutcomeKey;
    if (model === 'simple') {
      const detected = outcomeForRange(r, bars);
      let key: 'LONG_TRUE' | 'SHORT_TRUE' | null = null;
      if (detected.startsWith('LONG')) key = 'LONG_TRUE';
      else if (detected.startsWith('SHORT')) key = 'SHORT_TRUE';
      if (!key) key = groupedFull.LONG_TRUE.length ? 'LONG_TRUE' : (groupedFull.SHORT_TRUE.length ? 'SHORT_TRUE' : null);
      if (!key) continue;
      scenario = key;
    } else {
      // Pro/Beta: use selected outcome for latest quarter if set, otherwise auto-detect
      if (isProLikeModel && outcome && outcome !== 'AUTO' && isLatestQuarter) {
        scenario = outcome as OutcomeKey;
      } else {
        scenario = outcomeForRange(r, bars);
      }
    }

    const t1 = r.startTime + DAY;
    const t2 = r.endTime - DAY;
    if (t1 >= t2) continue;

    const i1 = findBarIdx(t1);
    const i2 = findBarIdx(t2);
    if (i1 >= i2) continue;

    let midPct = 0;

    if (scenario !== 'NONE') {
      if (model === 'simple') {
        // Simple model: individual horizontal lines for each level
        const scenarioLines = groupedFull[scenario as Exclude<OutcomeKey, 'NONE'>] || [];
        for (const line of scenarioLines) {
          const price = r.mid * (1 + (line.value as number) / 100);
          const nameU = (line.name || '').toUpperCase();
          const isHigh = /HIGH|UPPER/.test(nameU);
          const isLow = /LOW(?!ER)?|LOWER/.test(nameU);
          const is90 = /(?:_|)(90|9)\b/.test(nameU);
          const isSpecial90 = is90 && (isHigh || isLow);
          const highColor = theme.levelBlue;
          const lowColor = theme.levelPurple;
          let color = isHigh ? highColor : lowColor;
          if (isSpecial90) {
            const alpha = isHigh ? 0.8 : 0.7;
            color = hexA(color, alpha);
          }
          const width = isSpecial90 ? 2 : 1;
          const style: 'dotted' | 'dashed' = isSpecial90 ? 'dashed' : 'dotted';

          segments.push({
            t1: bars[i1].time,
            t2: bars[i2].time,
            price,
            pct: line.value as number,
            color,
            lineWidth: width,
            dashed: style === 'dashed',
            style,
          });

          // Label
          const pctLabel = (() => {
            const m = /_(\d+)\b/.exec(nameU);
            return m ? `${m[1]} %` : `${Math.round(Math.abs(line.value as number))} %`;
          })();
          const leftIdx = quarterLeftIdx(t1, 0);
          labels.push({
            time: bars[leftIdx].time,
            price,
            text: pctLabel,
            color,
            dy: isHigh ? -LABEL_OFFSET_PX : LABEL_OFFSET_PX,
            dx: 0,
          });
        }
      } else {
        // Pro/Beta: probability boxes from parsed index pairs
        const parsed = parseScenarioFixed(groupedFull[scenario as Exclude<OutcomeKey, 'NONE'>] || []);
        midPct = Number.isFinite(parsed.midPct) ? parsed.midPct : 0;

        // Index colors: 0,1 = purple (below mid), 2,3 = blue (above mid)
        const BOX_PURPLE = { fill: theme.boxPurpleFill, stroke: theme.boxPurpleStroke };
        const BOX_BLUE = { fill: theme.boxBlueFill, stroke: theme.boxBlueStroke };
        const colorsByPairIdx = [BOX_PURPLE, BOX_PURPLE, BOX_BLUE, BOX_BLUE];
        for (let pi = 0; pi < parsed.pairs.length; pi++) {
          const [loPct, hiPct] = parsed.pairs[pi];
          const pLow = r.mid * (1 + loPct / 100);
          const pHigh = r.mid * (1 + hiPct / 100);
          const c = colorsByPairIdx[Math.min(pi, colorsByPairIdx.length - 1)];
          boxes.push({
            t1: bars[i1].time,
            t2: bars[i2].time,
            priceLow: Math.min(pLow, pHigh),
            priceHigh: Math.max(pLow, pHigh),
            fill: c.fill,
            stroke: c.stroke,
          });
        }

        // Labels at the key indices
        const idxMap = levelIndexMap(groupedFull[scenario as Exclude<OutcomeKey, 'NONE'>] || []);
        const labelIndices = [1, 2, 3, 7, 8, 9];
        const leftIdx = quarterLeftIdx(t1, 0);
        for (const idx of labelIndices) {
          const e = idxMap[idx];
          if (!e) continue;
          const price = r.mid * (1 + e.pct / 100);
          const isUpper = idx > 5;
          const labelText = LABELS_BY_INDEX[idx];
          if (!labelText) continue;
          labels.push({
            time: bars[leftIdx].time,
            price,
            text: labelText,
            color: isUpper ? theme.levelBlue : theme.levelPurple,
            dy: isUpper ? -LABEL_OFFSET_PX : LABEL_OFFSET_PX,
            dx: 0,
          });
        }
      }
    }

    // Mid band (pro/beta only)
    if (model !== 'simple') {
      const midPrice = r.mid * (1 + midPct / 100);
      midBands.push({
        t1: bars[i1].time,
        t2: bars[i2].time,
        price: midPrice,
      });
    }
  }

  return { segments, boxes, midBands, labels };
}

// ============================================================================
// COORDINATE HELPERS
// ============================================================================

function niceStep(range: number, targetTicks: number): number {
  if (range <= 0 || targetTicks <= 0) return 1;
  const rough = range / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  let step: number;
  if (norm <= 1.5) step = 1;
  else if (norm <= 3) step = 2;
  else if (norm <= 7) step = 5;
  else step = 10;
  return step * mag;
}

function formatPrice(p: number): string {
  if (!Number.isFinite(p)) return '';
  const abs = Math.abs(p);
  if (abs >= 10000) return p.toFixed(0);
  if (abs >= 1000) return p.toFixed(1);
  if (abs >= 100) return p.toFixed(1);
  if (abs >= 10) return p.toFixed(2);
  if (abs >= 1) return p.toFixed(3);
  return p.toFixed(4);
}

function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate().toString().padStart(2, '0')}`;
}

function formatDateFull(ts: number): string {
  const d = new Date(ts * 1000);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function darkenColor(c: string, factor = 0.75, alpha = 1): string {
  const mRgba = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/i.exec(c);
  if (mRgba) {
    const r = +mRgba[1], g = +mRgba[2], b = +mRgba[3];
    const a = mRgba[4] != null ? +mRgba[4] : 1;
    return `rgba(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)},${Math.min(1, a * alpha)})`;
  }
  return c;
}

// ============================================================================
// NATIVE CHART COMPONENT
// ============================================================================

export interface NativeChartProps {
  bars: Bar[];
  levels: LevelLine[];
  model: string;
  outcome?: string;
  loading?: boolean;
  error?: string | null;
  onPriceInfo?: (info: { close: number; change: number; changePct: number } | null) => void;
  defaultVisibleBars?: number;
}

export default function NativeChart({
  bars,
  levels,
  model,
  outcome,
  loading,
  error,
  onPriceInfo,
  defaultVisibleBars = 220,
}: NativeChartProps) {
  const { theme } = useTheme();
  // Keep a ref so canvas render callbacks always see the latest theme
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const dirtyRef = useRef(true);

  // View state — float-based like lightweight-charts
  // barSpacing = pixels per bar, rightOffset = how many bars of space after the last bar
  const viewRef = useRef<{ barSpacing: number; rightOffset: number }>({ barSpacing: 6, rightOffset: 5 });
  // Custom Y-axis scale: null = auto-fit, otherwise user-defined
  const yScaleRef = useRef<{ minPrice: number; maxPrice: number } | null>(null);
  const visibleRef = useRef<VisibleRange>({ fromIdx: 0, toIdx: 0 });
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startRightOffset: number;
    mode: 'pan' | 'y-axis' | 'x-axis';
    startBarSpacing: number;
    startYScale: { minPrice: number; maxPrice: number } | null;
  }>({ active: false, startX: 0, startY: 0, startRightOffset: 0, mode: 'pan', startBarSpacing: 6, startYScale: null });
  const sizeRef = useRef<{ w: number; h: number; dpr: number }>({ w: 800, h: 400, dpr: 1 });

  // Cached level overlays
  const overlaysRef = useRef<{
    segments: LevelSegment[];
    boxes: ProbabilityBox[];
    midBands: MidBand[];
    labels: ChartLabel[];
  }>({ segments: [], boxes: [], midBands: [], labels: [] });

  // Track key for overlay computation to avoid redundant recomputation
  const overlayKeyRef = useRef('');

  // ---- Re-render and recompute overlays when theme changes ----
  useEffect(() => {
    // Recompute overlays with new theme colors
    overlayKeyRef.current = ''; // force recomputation
    if (bars.length && levels.length) {
      overlaysRef.current = buildLevelOverlays(bars, levels, model, theme, outcome);
    }
    dirtyRef.current = true;
  }, [theme]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Report price info when bars change ----
  useEffect(() => {
    if (!onPriceInfo || !bars.length) return;
    const last = bars[bars.length - 1];
    const prev = bars.length > 1 ? bars[bars.length - 2] : last;
    const change = last.close - prev.close;
    const changePct = prev.close !== 0 ? (change / prev.close) * 100 : 0;
    onPriceInfo({ close: last.close, change, changePct });
  }, [bars, onPriceInfo]);

  // ---- Compute level overlays when data/levels/model/outcome changes ----
  useEffect(() => {
    // Include first/last bar time + first level value to detect symbol swaps
    const barSig = bars.length ? `${bars[0].time}:${bars[bars.length-1].time}:${bars[bars.length-1].close}` : '0';
    const lvlSig = levels.length ? `${levels[0].name}:${levels[0].value}` : '0';
    const key = `${barSig}:${lvlSig}:${model}:${outcome ?? ''}`;
    if (key === overlayKeyRef.current) return;
    overlayKeyRef.current = key;
    overlaysRef.current = buildLevelOverlays(bars, levels, model, themeRef.current, outcome);
    dirtyRef.current = true;
  }, [bars, levels, model, outcome]);

  // ---- Coordinate mapping helpers (memoized) ----
  const getPlotArea = useCallback(() => {
    const { w, h } = sizeRef.current;
    return {
      left: MARGIN.left,
      top: MARGIN.top,
      width: Math.max(1, w - MARGIN.left - MARGIN.right),
      height: Math.max(1, h - MARGIN.top - MARGIN.bottom),
      right: w - MARGIN.right,
      bottom: h - MARGIN.bottom,
    };
  }, []);

  const getPriceRange = useCallback(() => {
    // If user has manually scaled Y-axis, use that
    if (yScaleRef.current) return yScaleRef.current;
    if (!bars.length) return { minPrice: 0, maxPrice: 1 };
    const { fromIdx, toIdx } = visibleRef.current;
    const from = Math.max(0, fromIdx);
    const to = Math.min(bars.length - 1, toIdx);
    let lo = Infinity, hi = -Infinity;
    for (let i = from; i <= to; i++) {
      if (bars[i].low < lo) lo = bars[i].low;
      if (bars[i].high > hi) hi = bars[i].high;
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { minPrice: 0, maxPrice: 1 };
    const range = hi - lo;
    const pad = range * PADDING_Y;
    return { minPrice: lo - pad, maxPrice: hi + pad };
  }, [bars]);

  // Helper: sync integer visibleRef from float-based viewRef
  const syncVisible = useCallback(() => {
    if (!bars.length) return;
    const plot = getPlotArea();
    const { barSpacing, rightOffset } = viewRef.current;
    const barsInView = Math.max(1, Math.floor(plot.width / barSpacing));
    const toIdx = bars.length - 1 + Math.floor(rightOffset);
    const fromIdx = toIdx - barsInView + 1;
    visibleRef.current = {
      fromIdx: Math.max(0, fromIdx),
      toIdx: Math.min(bars.length - 1, Math.max(0, toIdx)),
    };
  }, [bars, getPlotArea]);

  // Helper: float index at a given X coordinate (for zoom anchoring)
  const coordToFloatIdx = useCallback((x: number) => {
    const plot = getPlotArea();
    const { barSpacing, rightOffset } = viewRef.current;
    const rightEdgeIdx = bars.length - 1 + rightOffset;
    return rightEdgeIdx - (plot.right - x) / barSpacing;
  }, [bars, getPlotArea]);

  // ---- Initialize view when bars change ----
  useEffect(() => {
    if (!bars.length) return;

    // Ensure canvas is sized
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (container && canvas) {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);
      if (w > 0 && h > 0) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        sizeRef.current = { w, h, dpr };
      }
    }

    // Set initial barSpacing to show ~220 bars
    const plot = getPlotArea();
    const defaultVisible = defaultVisibleBars;
    const spacing = Math.max(1, plot.width / defaultVisible);
    viewRef.current = { barSpacing: spacing, rightOffset: 5 };
    yScaleRef.current = null; // reset to auto-fit on new data
    syncVisible();
    dirtyRef.current = true;
  }, [bars, getPlotArea, syncVisible]);

  // ============================================================================
  // MAIN RENDER FUNCTION
  // ============================================================================

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bars.length) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Read current theme from ref (always latest, avoids stale closures)
    const T = themeRef.current;

    const { w, h, dpr } = sizeRef.current;
    if (w <= 0 || h <= 0) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const plot = getPlotArea();
    const { minPrice, maxPrice } = getPriceRange();
    const priceRange = maxPrice - minPrice;
    if (priceRange <= 0) return;

    const { fromIdx, toIdx } = visibleRef.current;
    const visibleBars = Math.max(1, toIdx - fromIdx + 1);

    // Use float-based barSpacing from viewRef for sub-pixel smooth rendering
    const barSpacing = viewRef.current.barSpacing;
    const { rightOffset } = viewRef.current;
    // The right edge of the last bar (float) maps to plot.right
    const rightEdgeFloatIdx = bars.length - 1 + rightOffset;

    // ---- Coordinate mapping closures ----
    const priceToY = (price: number) =>
      plot.top + plot.height * (1 - (price - minPrice) / priceRange);

    const yToPrice = (y: number) =>
      minPrice + priceRange * (1 - (y - plot.top) / plot.height);

    const idxToX = (idx: number) =>
      plot.right - (rightEdgeFloatIdx - idx) * barSpacing;

    const xToIdx = (x: number) =>
      rightEdgeFloatIdx - (plot.right - x) / barSpacing;

    // Ported from lightweight-charts optimalCandlestickWidth
    let candleW: number;
    if (barSpacing >= 2.5 && barSpacing <= 4) {
      // Special case: force minimum visible width at small sizes
      candleW = Math.floor(3 * dpr) / dpr;
    } else {
      // Reducing coeff: 1.0 at small spacing, approaches 0.8 at large spacing
      const reducingCoeff = 0.2;
      const coeff = 1 - reducingCoeff * Math.atan(Math.max(4, barSpacing) - 4) / (Math.PI * 0.5);
      const res = Math.floor(barSpacing * coeff * dpr) / dpr;
      const scaledMax = Math.floor(barSpacing * dpr) / dpr;
      candleW = Math.min(res, scaledMax);
    }
    // Ensure minimum 1 physical pixel, max reasonable size
    candleW = Math.max(1 / dpr, Math.min(20, candleW));
    // At very small sizes (< 1.5px), switch to line rendering
    const useLineMode = candleW < 1.5;
    const halfCandle = candleW / 2;

    // ======================================================================
    // 1. BACKGROUND
    // ======================================================================
    ctx.clearRect(0, 0, w, h);
    if (!T.frosted) {
      ctx.fillStyle = T.bg;
      ctx.fillRect(0, 0, w, h);
    }

    // ======================================================================
    // 2. GRID
    // ======================================================================
    // Clip to plot area for grid + overlays + candles
    ctx.save();
    ctx.beginPath();
    ctx.rect(plot.left, plot.top, plot.width, plot.height);
    ctx.clip();

    // --- Horizontal grid lines (price) ---
    const pStep = niceStep(priceRange, Math.max(3, Math.floor(plot.height / 60)));
    const pStart = Math.ceil(minPrice / pStep) * pStep;
    ctx.strokeStyle = T.gridH;
    ctx.lineWidth = 1;
    for (let p = pStart; p <= maxPrice; p += pStep) {
      const y = Math.round(priceToY(p)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(plot.left, y);
      ctx.lineTo(plot.right, y);
      ctx.stroke();
    }

    // --- Vertical grid lines (time) ---
    const timeStep = Math.max(1, Math.ceil(visibleBars / Math.max(2, Math.floor(plot.width / 100))));
    ctx.strokeStyle = T.gridV;
    for (let i = fromIdx; i <= toIdx; i += timeStep) {
      if (i < 0 || i >= bars.length) continue;
      const x = Math.round(idxToX(i)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, plot.top);
      ctx.lineTo(x, plot.bottom);
      ctx.stroke();
    }

    // ======================================================================
    // 3. LEVEL OVERLAYS (the key feature — native rendering)
    // ======================================================================
    const { segments, boxes, midBands, labels: overlayLabels } = overlaysRef.current;

    // Binary search: map a timestamp to the nearest bar index
    const timeToBarIdx = (t: number): number => {
      let lo = 0, hi = bars.length - 1, best = 0, bestD = Infinity;
      while (lo <= hi) {
        const m = (lo + hi) >> 1;
        const d = Math.abs(bars[m].time - t);
        if (d < bestD) { bestD = d; best = m; }
        if (bars[m].time < t) lo = m + 1; else hi = m - 1;
      }
      return best;
    };

    // --- Probability boxes ---
    for (const box of boxes) {
      const bi1 = timeToBarIdx(box.t1);
      const bi2 = timeToBarIdx(box.t2);
      if (bi2 < fromIdx || bi1 > toIdx) continue;

      const x1 = idxToX(Math.max(bi1, fromIdx));
      const x2 = idxToX(Math.min(bi2, toIdx));
      const y1 = priceToY(box.priceHigh);
      const y2 = priceToY(box.priceLow);

      const left = Math.min(x1, x2);
      const right = Math.max(x1, x2);
      const top = Math.min(y1, y2);
      const bottom = Math.max(y1, y2);
      const bw = Math.max(1, right - left);
      const bh = Math.max(1, bottom - top);

      // Fill
      ctx.fillStyle = box.fill;
      ctx.fillRect(Math.round(left), Math.round(top), Math.round(bw), Math.round(bh));

      // Top/bottom border (darker, pixel-snapped)
      const edge = darkenColor(box.stroke, 0.72, 1);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1;
      ctx.lineCap = 'butt';
      // Top edge
      ctx.beginPath();
      ctx.moveTo(Math.round(left) + 0.5, Math.round(top) + 0.5);
      ctx.lineTo(Math.round(left + bw) - 0.5, Math.round(top) + 0.5);
      ctx.stroke();
      // Bottom edge
      ctx.beginPath();
      ctx.moveTo(Math.round(left) + 0.5, Math.round(top + bh) - 0.5);
      ctx.lineTo(Math.round(left + bw) - 0.5, Math.round(top + bh) - 0.5);
      ctx.stroke();
    }

    // --- Level line segments (simple model) ---
    for (const seg of segments) {
      const si1 = timeToBarIdx(seg.t1);
      const si2 = timeToBarIdx(seg.t2);
      if (si2 < fromIdx || si1 > toIdx) continue;

      const x1 = idxToX(Math.max(si1, fromIdx));
      const x2 = idxToX(Math.min(si2, toIdx));
      const y = priceToY(seg.price);

      ctx.strokeStyle = seg.color;
      ctx.lineWidth = seg.lineWidth;
      if (seg.style === 'dashed') {
        ctx.setLineDash([6, 4]);
      } else if (seg.style === 'dotted') {
        ctx.setLineDash([2, 3]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.beginPath();
      ctx.moveTo(x1, Math.round(y) + 0.5);
      ctx.lineTo(x2, Math.round(y) + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // --- Mid bands (pro/beta) ---
    for (const mb of midBands) {
      const mi1 = timeToBarIdx(mb.t1);
      const mi2 = timeToBarIdx(mb.t2);
      if (mi2 < fromIdx || mi1 > toIdx) continue;

      const x1 = idxToX(Math.max(mi1, fromIdx));
      const x2 = idxToX(Math.min(mi2, toIdx));
      const y = priceToY(mb.price);
      const left = Math.min(x1, x2);
      const right = Math.max(x1, x2);
      const effectiveRight = Math.max(right, left + 2); // ensure minimum width

      ctx.strokeStyle = T.midBand;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(Math.round(left), Math.round(y) + 0.5);
      ctx.lineTo(Math.round(effectiveRight), Math.round(y) + 0.5);
      ctx.stroke();

      // Second stroke for the band thickness
      if (MID_BAND_PX > 1) {
        ctx.beginPath();
        ctx.moveTo(Math.round(left), Math.round(y) + MID_BAND_PX + 0.5);
        ctx.lineTo(Math.round(effectiveRight), Math.round(y) + MID_BAND_PX + 0.5);
        ctx.stroke();
      }
    }

    // --- Labels (percentage markers like "20 %", "50 %", "80 %") ---
    ctx.font = `bold 10px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const EDGE_MARGIN = 12;
    const PAD = 3;
    const TEXT_H = 12;

    type Cand = { x: number; y: number; text: string; color: string };
    const cands: Cand[] = [];
    for (const lb of overlayLabels) {
      const li = timeToBarIdx(lb.time);
      if (li < fromIdx || li > toIdx) continue;
      const x0 = idxToX(li);
      const yLine = priceToY(lb.price);
      const y = yLine + (lb.dy || 0);
      if (y < plot.top + EDGE_MARGIN || y > plot.bottom - EDGE_MARGIN) continue;
      let x = x0 + (lb.dx ?? 8);
      x = Math.max(plot.left + 6, Math.min(x, plot.right - 6));
      cands.push({ x, y, text: lb.text, color: lb.color });
    }

    // Sort left-to-right, then top-to-bottom for stable placement
    cands.sort((a, b) => (a.x - b.x) || (a.y - b.y));

    // Place labels with collision detection
    type Rect = { x: number; y: number; w: number; h: number };
    const placed: { rect: Rect; c: Cand }[] = [];
    const intersects = (a: Rect, b: Rect, pad = PAD) =>
      !(a.x + a.w + pad < b.x || b.x + b.w + pad < a.x || a.y + a.h + pad < b.y || b.y + b.h + pad < a.y);

    // Check if a label rect overlaps any candle's high-low wick range
    const labelHitsCandle = (rect: Rect): boolean => {
      // Find which bar indices the label spans horizontally
      const idxLeft = Math.floor(xToIdx(rect.x));
      const idxRight = Math.ceil(xToIdx(rect.x + rect.w));
      for (let bi = Math.max(0, idxLeft - 1); bi <= Math.min(bars.length - 1, idxRight + 1); bi++) {
        if (bi < fromIdx || bi > toIdx) continue;
        const bar = bars[bi];
        const wickTop = priceToY(bar.high);
        const wickBot = priceToY(bar.low);
        const cx = idxToX(bi);
        const candleLeft = cx - halfCandle - 2;
        const candleRight = cx + halfCandle + 2;
        // Check overlap: label rect vs candle column
        if (rect.x + rect.w > candleLeft && rect.x < candleRight &&
            rect.y + rect.h > wickTop && rect.y < wickBot) {
          return true;
        }
      }
      return false;
    };

    for (const c of cands) {
      const tw = Math.ceil(ctx.measureText(c.text).width);
      let labelX = Math.round(c.x);
      let rect: Rect = { x: labelX, y: Math.round(c.y - TEXT_H / 2), w: tw, h: TEXT_H };
      if (rect.y < plot.top + EDGE_MARGIN || rect.y + rect.h > plot.bottom - EDGE_MARGIN) continue;

      // Shift right until the label doesn't overlap any candle or prior label
      let attempts = 0;
      while ((labelHitsCandle(rect) || placed.some(p => intersects(p.rect, rect))) && attempts < 30) {
        labelX += barSpacing;
        rect = { x: labelX, y: rect.y, w: tw, h: TEXT_H };
        attempts++;
      }

      if (labelX + tw > plot.right) continue;
      if (placed.some(p => intersects(p.rect, rect))) continue;
      placed.push({ rect, c: { ...c, x: labelX } });
    }

    for (const { rect, c } of placed) {
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, rect.x, rect.y + TEXT_H / 2);
    }

    // ======================================================================
    // 4. CANDLESTICKS
    // ======================================================================
    for (let i = fromIdx; i <= toIdx && i < bars.length; i++) {
      if (i < 0) continue;
      const bar = bars[i];
      const x = idxToX(i);
      const isUp = bar.close >= bar.open;

      const bodyTop = priceToY(Math.max(bar.open, bar.close));
      const bodyBot = priceToY(Math.min(bar.open, bar.close));
      const wickTop = priceToY(bar.high);
      const wickBot = priceToY(bar.low);

      if (useLineMode) {
        // Ultra-zoomed out: single vertical line from high to low, colored by direction
        ctx.strokeStyle = isUp ? T.candleUpBody : T.candleDownBody;
        ctx.lineWidth = Math.max(1, Math.round(candleW * dpr) / dpr);
        ctx.beginPath();
        ctx.moveTo(Math.round(x * dpr) / dpr, wickTop);
        ctx.lineTo(Math.round(x * dpr) / dpr, wickBot);
        ctx.stroke();
      } else {
        // Wick
        ctx.strokeStyle = isUp ? T.candleUpWick : T.candleDownWick;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, wickTop);
        ctx.lineTo(Math.round(x) + 0.5, wickBot);
        ctx.stroke();

        // Body
        const bodyH = Math.max(1, bodyBot - bodyTop);
        ctx.fillStyle = isUp ? T.candleUpBody : T.candleDownBody;
        ctx.fillRect(
          Math.round(x - halfCandle),
          Math.round(bodyTop),
          Math.round(candleW),
          Math.round(bodyH)
        );

        // Body outline (only when candles are wide enough)
        if (candleW >= 3) {
          ctx.strokeStyle = isUp ? T.candleUpWick : T.candleDownWick;
          ctx.lineWidth = 1;
          ctx.strokeRect(
            Math.round(x - halfCandle) + 0.5,
            Math.round(bodyTop) + 0.5,
            Math.round(candleW) - 1,
            Math.max(0, Math.round(bodyH) - 1)
          );
        }
      }
    }

    // End plot area clip
    ctx.restore();

    // ======================================================================
    // 5. CROSSHAIR
    // ======================================================================
    if (mouseRef.current.active) {
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      if (mx >= plot.left && mx <= plot.right && my >= plot.top && my <= plot.bottom) {
        // Dashed crosshair lines
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = T.crosshair;
        ctx.lineWidth = 1;

        // Horizontal
        ctx.beginPath();
        ctx.moveTo(plot.left, Math.round(my) + 0.5);
        ctx.lineTo(plot.right, Math.round(my) + 0.5);
        ctx.stroke();

        // Vertical
        ctx.beginPath();
        ctx.moveTo(Math.round(mx) + 0.5, plot.top);
        ctx.lineTo(Math.round(mx) + 0.5, plot.bottom);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.restore();

        // Price badge on right Y-axis
        const crossPrice = yToPrice(my);
        const priceText = formatPrice(crossPrice);
        ctx.font = `${FONT_SIZE}px ${FONT}`;
        ctx.fillStyle = T.text;
        ctx.fillRect(plot.right + 1, Math.round(my) - 10, MARGIN.right - 1, 20);
        ctx.fillStyle = T.badgeText;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(priceText, plot.right + MARGIN.right / 2, Math.round(my));

        // Date badge on bottom X-axis
        const crossIdx = Math.round(xToIdx(mx));
        if (crossIdx >= 0 && crossIdx < bars.length) {
          const dateText = formatDateFull(bars[crossIdx].time);
          ctx.font = `${FONT_SIZE}px ${FONT}`;
          const dw = ctx.measureText(dateText).width + 12;
          ctx.fillStyle = T.text;
          ctx.fillRect(Math.round(mx) - dw / 2, plot.bottom + 1, dw, MARGIN.bottom - 1);
          ctx.fillStyle = T.badgeText;
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'center';
          ctx.fillText(dateText, Math.round(mx), plot.bottom + MARGIN.bottom / 2);
        }
      }
    }

    // ======================================================================
    // 6. AXES
    // ======================================================================

    // --- Right Y-axis: price labels ---
    ctx.font = `${FONT_SIZE}px ${FONT}`;
    ctx.fillStyle = T.axisText;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    for (let p = pStart; p <= maxPrice; p += pStep) {
      const y = priceToY(p);
      if (y < plot.top || y > plot.bottom) continue;
      ctx.fillText(formatPrice(p), w - 4, y);
    }

    // Y-axis border
    ctx.strokeStyle = T.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plot.right + 0.5, plot.top);
    ctx.lineTo(plot.right + 0.5, plot.bottom);
    ctx.stroke();

    // --- Bottom X-axis: date labels (MMM DD format) ---
    ctx.fillStyle = T.axisText;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    const dateLabelStep = Math.max(1, Math.ceil(visibleBars / Math.max(2, Math.floor(plot.width / 80))));
    for (let i = fromIdx; i <= toIdx && i < bars.length; i += dateLabelStep) {
      if (i < 0) continue;
      const x = idxToX(i);
      if (x < plot.left + 20 || x > plot.right - 20) continue;
      ctx.fillText(formatDate(bars[i].time), x, plot.bottom + 6);
    }

    // X-axis border
    ctx.strokeStyle = T.border;
    ctx.beginPath();
    ctx.moveTo(plot.left, plot.bottom + 0.5);
    ctx.lineTo(plot.right, plot.bottom + 0.5);
    ctx.stroke();

    // ======================================================================
    // 7. OHLC DISPLAY — hover bar or last bar when no cursor
    // ======================================================================
    {
      let ohlcBar: Bar | null = null;
      if (mouseRef.current.active) {
        const mx = mouseRef.current.x;
        if (mx >= plot.left && mx <= plot.right) {
          const hoverIdx = Math.round(xToIdx(mx));
          if (hoverIdx >= 0 && hoverIdx < bars.length) {
            ohlcBar = bars[hoverIdx];
          }
        }
      }
      // Fallback to last bar when cursor is not on chart
      if (!ohlcBar && bars.length > 0) {
        ohlcBar = bars[bars.length - 1];
      }
      if (ohlcBar) {
        const isUp = ohlcBar.close >= ohlcBar.open;
        const ohlcText = `O ${formatPrice(ohlcBar.open)}  H ${formatPrice(ohlcBar.high)}  L ${formatPrice(ohlcBar.low)}  C ${formatPrice(ohlcBar.close)}`;
        ctx.font = `${FONT_SIZE}px ${FONT}`;
        ctx.fillStyle = isUp ? T.positive : T.negative;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.fillText(ohlcText, plot.left + 6, plot.top + 2);
      }
    }

    // ======================================================================
    // 8. NO LEVELS WARNING
    // ======================================================================
    const { segments: oSegs, boxes: oBoxes } = overlaysRef.current;
    const hasLevels = oSegs.length > 0 || oBoxes.length > 0;
    const WARN_COLOR = '#eab308'; // vivid bee yellow
    if (bars.length > 0 && !hasLevels) {
      const msg = 'Not enough data for levels — Use Beta model';
      const warnY = plot.top + 20;
      const warnX = plot.left + 6;
      const triSize = 14;
      // Triangle
      ctx.fillStyle = WARN_COLOR;
      ctx.beginPath();
      ctx.moveTo(warnX, warnY + triSize);
      ctx.lineTo(warnX + triSize / 2, warnY);
      ctx.lineTo(warnX + triSize, warnY + triSize);
      ctx.closePath();
      ctx.fill();
      // Exclamation mark
      ctx.fillStyle = T.bg;
      ctx.font = `bold 9px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', warnX + triSize / 2, warnY + triSize * 0.6);
      // Warning text
      ctx.fillStyle = WARN_COLOR;
      ctx.font = `bold 12px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(msg, warnX + triSize + 8, warnY + 1);
    }

    dirtyRef.current = false;
  }, [bars, levels, getPlotArea, getPriceRange]);

  // ============================================================================
  // ANIMATION LOOP
  // ============================================================================

  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      if (dirtyRef.current) {
        render();
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [render]);

  // ============================================================================
  // RESIZE OBSERVER — DPR-aware canvas sizing
  // ============================================================================

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);
      if (w <= 0 || h <= 0) return;

      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      sizeRef.current = { w, h, dpr };
      dirtyRef.current = true;
    };

    resizeCanvas();

    const ro = new ResizeObserver(() => {
      resizeCanvas();
      dirtyRef.current = true;
    });
    ro.observe(container);

    // Also listen for window resize as fallback
    const onWinResize = () => { resizeCanvas(); dirtyRef.current = true; };
    window.addEventListener('resize', onWinResize);

    return () => { ro.disconnect(); window.removeEventListener('resize', onWinResize); };
  }, []);

  // ============================================================================
  // MOUSE INTERACTIONS
  // ============================================================================

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      mouseRef.current = { x, y, active: true };
      const plot = getPlotArea();

      if (dragRef.current.active) {
        if (dragRef.current.mode === 'pan') {
          // Horizontal pan
          const dx = e.clientX - dragRef.current.startX;
          const barShift = -dx / viewRef.current.barSpacing;
          viewRef.current.rightOffset = dragRef.current.startRightOffset + barShift;
          syncVisible();
          // Vertical pan (only when Y is manually scaled)
          if (dragRef.current.startYScale) {
            const dy = e.clientY - dragRef.current.startY;
            const priceRange = dragRef.current.startYScale.maxPrice - dragRef.current.startYScale.minPrice;
            const priceDelta = (dy / plot.height) * priceRange;
            yScaleRef.current = {
              minPrice: dragRef.current.startYScale.minPrice + priceDelta,
              maxPrice: dragRef.current.startYScale.maxPrice + priceDelta,
            };
          }
        } else if (dragRef.current.mode === 'y-axis') {
          // Drag Y-axis: scale price range vertically
          const dy = e.clientY - dragRef.current.startY;
          const scaleFactor = 1 + dy * 0.005;
          const baseRange = dragRef.current.startYScale || getPriceRange();
          const mid = (baseRange.minPrice + baseRange.maxPrice) / 2;
          const halfRange = (baseRange.maxPrice - baseRange.minPrice) / 2 * scaleFactor;
          yScaleRef.current = { minPrice: mid - halfRange, maxPrice: mid + halfRange };
        } else if (dragRef.current.mode === 'x-axis') {
          // Drag X-axis: zoom time scale
          const dx = e.clientX - dragRef.current.startX;
          const scaleFactor = 1 - dx * 0.003; // drag right = zoom in, drag left = zoom out
          const newSpacing = Math.max(0.5, Math.min(plot.width * 0.5,
            dragRef.current.startBarSpacing * scaleFactor));
          const idxAtCenter = coordToFloatIdx(plot.left + plot.width / 2);
          viewRef.current.barSpacing = newSpacing;
          const newIdxAtCenter = coordToFloatIdx(plot.left + plot.width / 2);
          viewRef.current.rightOffset += (idxAtCenter - newIdxAtCenter);
          syncVisible();
        }
      }

      // Update cursor based on hover zone
      if (!dragRef.current.active) {
        if (x > plot.right) {
          canvas.style.cursor = 'ns-resize';
        } else if (y > plot.bottom) {
          canvas.style.cursor = 'ew-resize';
        } else {
          canvas.style.cursor = 'crosshair';
        }
      }

      dirtyRef.current = true;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const plot = getPlotArea();

      let mode: 'pan' | 'y-axis' | 'x-axis' = 'pan';
      if (x > plot.right) {
        mode = 'y-axis';
        canvas.style.cursor = 'ns-resize';
      } else if (y > plot.bottom) {
        mode = 'x-axis';
        canvas.style.cursor = 'ew-resize';
      } else {
        canvas.style.cursor = 'grabbing';
      }

      dragRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        startRightOffset: viewRef.current.rightOffset,
        mode,
        startBarSpacing: viewRef.current.barSpacing,
        startYScale: mode === 'pan' ? yScaleRef.current : (yScaleRef.current || getPriceRange()),
      };
    };

    const onMouseUp = () => {
      dragRef.current.active = false;
      canvas.style.cursor = 'crosshair';
    };

    const onMouseLeave = () => {
      mouseRef.current.active = false;
      dragRef.current.active = false;
      canvas.style.cursor = 'crosshair';
      dirtyRef.current = true;
    };

    const onWheel = (e: WheelEvent) => {
      // Exact port of lightweight-charts _private__onMousewheel + _internal_zoom
      if (e.deltaX === 0 && e.deltaY === 0) return;
      if (e.cancelable) e.preventDefault();

      const rect = canvas.getBoundingClientRect();

      // Speed adjustment per lightweight-charts _private__determineWheelSpeedAdjustment
      let speedAdj = 1;
      switch (e.deltaMode) {
        case 2: speedAdj = 120; break;
        case 1: speedAdj = 32; break;
        default: {
          const isWinChrome = /Chrome/.test(navigator.userAgent) && /Win/.test(navigator.platform);
          if (isWinChrome) speedAdj = 1 / (window.devicePixelRatio || 1);
        }
      }

      const deltaX = speedAdj * e.deltaX / 100;
      const deltaY = -(speedAdj * e.deltaY / 100);

      // Zoom: deltaY → adjust barSpacing (exactly like lightweight-charts _internal_zoom)
      if (deltaY !== 0) {
        const zoomScale = Math.sign(deltaY) * Math.min(1, Math.abs(deltaY));
        const zoomPoint = e.clientX - rect.left;

        // Save float index at zoom point before changing spacing
        const idxAtZoom = coordToFloatIdx(zoomPoint);

        // Adjust bar spacing proportionally
        const { barSpacing } = viewRef.current;
        const plot = getPlotArea();
        const minSpacing = 0.5;
        const maxSpacing = plot.width * 0.5;
        const newSpacing = Math.max(minSpacing, Math.min(maxSpacing, barSpacing + zoomScale * (barSpacing / 10)));
        viewRef.current.barSpacing = newSpacing;

        // Correct rightOffset so the bar under the cursor stays in place
        const newIdxAtZoom = coordToFloatIdx(zoomPoint);
        viewRef.current.rightOffset += (idxAtZoom - newIdxAtZoom);
        syncVisible();
      }

      // Scroll: deltaX → shift rightOffset (exactly like lightweight-charts _internal_scrollChart)
      if (deltaX !== 0) {
        const scrollPx = deltaX * 80;
        viewRef.current.rightOffset += scrollPx / viewRef.current.barSpacing;
        syncVisible();
      }

      dirtyRef.current = true;
    };

    const onDblClick = (e: MouseEvent) => {
      if (!bars.length) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const plot = getPlotArea();

      if (x > plot.right) {
        // Double-click Y-axis: reset to auto-fit price range
        yScaleRef.current = null;
      } else {
        // Double-click chart: fit all data
        viewRef.current = { barSpacing: Math.max(1, plot.width / bars.length), rightOffset: 5 };
        yScaleRef.current = null;
        syncVisible();
      }
      dirtyRef.current = true;
    };

    // ── Touch handlers for mobile ──
    let touchStartX = 0;
    let touchStartOffset = 0;
    let pinchStartDist = 0;
    let pinchStartSpacing = 0;
    const axisTouchOverlap = 10;

    const onTouchStart = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        const plot = getPlotArea();
        let mode: 'pan' | 'y-axis' | 'x-axis' = 'pan';
        if (x > plot.right - axisTouchOverlap) {
          mode = 'y-axis';
        } else if (y > plot.bottom - axisTouchOverlap) {
          mode = 'x-axis';
        }

        dragRef.current = {
          active: true,
          startX: touch.clientX,
          startY: touch.clientY,
          startRightOffset: viewRef.current.rightOffset,
          mode,
          startBarSpacing: viewRef.current.barSpacing,
          startYScale: mode === 'pan' ? yScaleRef.current : (yScaleRef.current || getPriceRange()),
        };

        touchStartX = touch.clientX;
        touchStartOffset = viewRef.current.rightOffset;
      } else if (e.touches.length === 2) {
        dragRef.current.active = false;
        pinchStartDist = Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY
        );
        pinchStartSpacing = viewRef.current.barSpacing;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const plot = getPlotArea();
        if (dragRef.current.mode === 'y-axis') {
          const dy = touch.clientY - dragRef.current.startY;
          const scaleFactor = 1 + dy * 0.005;
          const baseRange = dragRef.current.startYScale || getPriceRange();
          const mid = (baseRange.minPrice + baseRange.maxPrice) / 2;
          const halfRange = (baseRange.maxPrice - baseRange.minPrice) / 2 * scaleFactor;
          yScaleRef.current = { minPrice: mid - halfRange, maxPrice: mid + halfRange };
        } else if (dragRef.current.mode === 'x-axis') {
          const dx = touch.clientX - dragRef.current.startX;
          const scaleFactor = 1 - dx * 0.003;
          const newSpacing = Math.max(0.5, Math.min(plot.width * 0.5, dragRef.current.startBarSpacing * scaleFactor));
          const idxAtCenter = coordToFloatIdx(plot.left + plot.width / 2);
          viewRef.current.barSpacing = newSpacing;
          const newIdxAtCenter = coordToFloatIdx(plot.left + plot.width / 2);
          viewRef.current.rightOffset += (idxAtCenter - newIdxAtCenter);
          syncVisible();
        } else {
          const dx = touch.clientX - touchStartX;
          const barShift = -dx / viewRef.current.barSpacing;
          viewRef.current.rightOffset = touchStartOffset + barShift;
          syncVisible();
          if (dragRef.current.startYScale) {
            const dy = touch.clientY - dragRef.current.startY;
            const priceRange = dragRef.current.startYScale.maxPrice - dragRef.current.startYScale.minPrice;
            const priceDelta = (dy / plot.height) * priceRange;
            yScaleRef.current = {
              minPrice: dragRef.current.startYScale.minPrice + priceDelta,
              maxPrice: dragRef.current.startYScale.maxPrice + priceDelta,
            };
          }
        }
        dirtyRef.current = true;
      } else if (e.touches.length === 2) {
        const rect = canvas.getBoundingClientRect();
        const pinchCenterX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left;
        const idxAtPinch = coordToFloatIdx(pinchCenterX);
        const dist = Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY
        );
        if (pinchStartDist <= 0) return;
        const scale = dist / pinchStartDist;
        const plot = getPlotArea();
        const newSpacing = Math.max(0.5, Math.min(plot.width * 0.5, pinchStartSpacing * scale));
        viewRef.current.barSpacing = newSpacing;
        const newIdxAtPinch = coordToFloatIdx(pinchCenterX);
        viewRef.current.rightOffset += (idxAtPinch - newIdxAtPinch);
        syncVisible();
        dirtyRef.current = true;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartOffset = viewRef.current.rightOffset;
        dragRef.current = {
          active: true,
          startX: e.touches[0].clientX,
          startY: e.touches[0].clientY,
          startRightOffset: viewRef.current.rightOffset,
          mode: 'pan',
          startBarSpacing: viewRef.current.barSpacing,
          startYScale: yScaleRef.current,
        };
      } else if (e.touches.length < 2) {
        pinchStartDist = 0;
        dragRef.current.active = false;
      }
      dirtyRef.current = true;
    };

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('dblclick', onDblClick);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchEnd);
    window.addEventListener('mouseup', onMouseUp);

    canvas.style.cursor = 'crosshair';

    return () => {
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('dblclick', onDblClick);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [bars, getPlotArea, syncVisible, coordToFloatIdx]);

  // ============================================================================
  // JSX
  // ============================================================================

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={{ background: theme.frosted ? 'transparent' : theme.bg }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ display: 'block', touchAction: 'none' }}
      />
      {/* Reset view button */}
      {bars.length > 0 && (
        <button
          onClick={() => {
            yScaleRef.current = null;
            const plot = getPlotArea();
            const defaultVisible = defaultVisibleBars;
            const spacing = Math.max(1, plot.width / defaultVisible);
            viewRef.current = { barSpacing: spacing, rightOffset: 5 };
            syncVisible();
            dirtyRef.current = true;
          }}
          title="Reset view"
          style={{
            position: 'absolute',
            top: 6,
            right: MARGIN.right + 6,
            zIndex: 5,
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.5)',
            border: `1px solid ${theme.border}`,
            borderRadius: 4,
            cursor: 'pointer',
            color: theme.textDim,
            fontSize: 11,
            fontFamily: FONT,
            padding: 0,
            lineHeight: 1,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = theme.text; e.currentTarget.style.background = 'rgba(255,255,255,0.8)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = theme.textDim; e.currentTarget.style.background = 'rgba(255,255,255,0.5)'; }}
        >
          ↺
        </button>
      )}
      {loading && !bars.length && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-[12px] animate-pulse"
            style={{ color: theme.textDim, fontFamily: FONT }}
          >
            Loading...
          </span>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-[12px]"
            style={{ color: theme.negative, fontFamily: FONT }}
          >
            {error}
          </span>
        </div>
      )}
    </div>
  );
}
