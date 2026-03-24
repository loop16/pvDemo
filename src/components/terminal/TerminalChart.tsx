'use client';

import { createChart, ISeriesApi, UTCTimestamp, LineType } from 'lightweight-charts';
import { useEffect, useRef, useCallback } from 'react';
import type { Bar, LevelLine, OutcomeKey, ProbabilityBox, MidBand, LevelSegment, QuarterRange } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

const DAY_SEC = 86400;

const LEVEL_BLUE = '#2962ff';
const LEVEL_PURPLE = '#9C27B0';
const MID_BAND_EDGE = 'rgba(244,63,94,0.7)';
const MID_BAND_PX = 1;

const BOX_PURPLE = { fill: 'rgba(156,39,176,0.14)', stroke: 'rgba(156,39,176,0.30)' };
const BOX_BLUE = { fill: 'rgba(41,98,255,0.16)', stroke: 'rgba(41,98,255,0.30)' };

const LABELS_BY_INDEX: Record<number, string> = {
  1: '20 %', 2: '50 %', 3: '80 %', 7: '80 %', 8: '50 %', 9: '20 %',
};

const CHART_OPTIONS = {
  layout: {
    background: { color: '#0a0a0a' },
    textColor: '#666',
    fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
    fontSize: 11,
  },
  grid: {
    vertLines: { color: '#1a1a1a' },
    horzLines: { color: '#1a1a1a' },
  },
  crosshair: {
    mode: 0 as const,
    vertLine: { color: '#333', labelBackgroundColor: '#1a1a1a' },
    horzLine: { color: '#333', labelBackgroundColor: '#1a1a1a' },
  },
  timeScale: {
    borderColor: '#1a1a1a',
    timeVisible: false,
    rightOffset: 10,
    barSpacing: 6,
  },
  rightPriceScale: {
    borderColor: '#1a1a1a',
    scaleMargins: { top: 0.12, bottom: 0.08 },
  },
  handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
  handleScale: {
    mouseWheel: true,
    pinch: true,
    axisPressedMouseMove: { price: true, time: true },
    axisDoubleClickReset: { price: true, time: true },
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function hexA(hex: string, a = 1) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

function darkenColor(c: string, factor = 0.75, alpha = 1): string {
  const mHex = /^#([0-9a-f]{6})$/i.exec(c);
  if (mHex) {
    const n = parseInt(mHex[1], 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)},${alpha})`;
  }
  const mRgba = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/i.exec(c);
  if (mRgba) {
    const r = +mRgba[1], g = +mRgba[2], b = +mRgba[3], a = mRgba[4] != null ? +mRgba[4] : 1;
    return `rgba(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)},${Math.min(1, a * alpha)})`;
  }
  return c;
}

// ============================================================================
// QUARTER DETECTION
// ============================================================================

function quarterOf(d: Date) {
  return Math.floor(d.getUTCMonth() / 3) + 1;
}

function isFriday(ts: number) {
  return new Date(ts * 1000).getUTCDay() === 5;
}

function findQuarterRanges(bars: Bar[]): QuarterRange[] {
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
    const friTs = bars[firstFriIdx].time;
    const d = new Date(friTs * 1000);
    const isFirstDayOfQuarter = d.getUTCDate() === 1 && (d.getUTCMonth() % 3 === 0);
    if (isFirstDayOfQuarter && firstFriIdx > 0) {
      prevIdx = firstFriIdx - 1;
    }

    const high = Math.max(bars[prevIdx].high, bars[firstFriIdx].high);
    const low = Math.min(bars[prevIdx].low, bars[firstFriIdx].low);
    const mid = (high + low) / 2;

    const thisPos = qkeys.indexOf(key);
    const hasNext = thisPos < qkeys.length - 1;
    let endTime = bars[idxs[idxs.length - 1]].time + DAY_SEC;
    if (hasNext) {
      const nextIdxs = byQ.get(qkeys[thisPos + 1])!;
      const nextFri = nextIdxs.find(i => isFriday(bars[i].time)) ?? nextIdxs[0];
      endTime = bars[nextFri].time;
    }

    ranges.push({ qkey: key, startTime: bars[firstFriIdx].time, endTime, high, low, mid });
  }
  return ranges;
}

// ============================================================================
// OUTCOME DETECTION
// ============================================================================

function outcomeForRange(range: QuarterRange, bars: Bar[]): OutcomeKey {
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
// LEVEL BUILDING
// ============================================================================

type ScenarioLine = { name: string; value: number; style?: string; color?: string };
type Label = { t: number; price: number; text: string; color: string; dy: number; dx: number };

function groupScenarioLines(lines: LevelLine[]) {
  const out: Record<Exclude<OutcomeKey, 'NONE'>, ScenarioLine[]> = {
    LONG_TRUE: [], LONG_FALSE: [], SHORT_TRUE: [], SHORT_FALSE: [],
  };
  for (const l of lines || []) {
    const upper = (l.name || '').toUpperCase();
    if (upper.startsWith('LONG_TRUE')) out.LONG_TRUE.push(l as ScenarioLine);
    else if (upper.startsWith('LONG_FALSE')) out.LONG_FALSE.push(l as ScenarioLine);
    else if (upper.startsWith('SHORT_TRUE')) out.SHORT_TRUE.push(l as ScenarioLine);
    else if (upper.startsWith('SHORT_FALSE')) out.SHORT_FALSE.push(l as ScenarioLine);
    else if (upper.startsWith('LONG_')) out.LONG_TRUE.push(l as ScenarioLine);
    else if (upper.startsWith('SHORT_')) out.SHORT_TRUE.push(l as ScenarioLine);
  }
  return out;
}

function parseScenarioFixed(lines: ScenarioLine[]) {
  const byIdx: Record<number, { pct: number; style: string; color: string }> = {};
  for (const l of lines || []) {
    const m = /_(\d+)$/.exec(l.name || '');
    if (!m) continue;
    const idx = +m[1];
    const pct = +l.value;
    if (!Number.isFinite(pct)) continue;
    byIdx[idx] = {
      pct,
      style: (l.style || 'solid').toLowerCase() === 'dashed' ? 'dashed' : 'solid',
      color: l.color || '#666',
    };
  }

  let mid = byIdx[5];
  if (!mid) {
    let bestIdx = -1, bestAbs = Infinity;
    for (const k in byIdx) {
      const idx = +k, abs = Math.abs(byIdx[idx].pct);
      if (abs < bestAbs) { bestAbs = abs; bestIdx = idx; }
    }
    mid = bestIdx > 0 ? byIdx[bestIdx] : { pct: 0, style: 'solid', color: '#666' };
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

  return { midPct: mid.pct, pairs, byIdx };
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

function quarterLeftTime(t1: number, bars: Bar[], offsetBars = 2): number {
  if (!bars.length) return t1;
  let i = 0;
  while (i < bars.length && bars[i].time < t1) i++;
  i = Math.min(bars.length - 1, i + Math.max(0, offsetBars));
  return bars[i].time;
}

// Lower/upper bound for snapping segments to actual bar times
function lowerBound(arr: number[], x: number) {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const m = (lo + hi) >>> 1; if (arr[m] < x) lo = m + 1; else hi = m; }
  return lo;
}
function upperBound(arr: number[], x: number) {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const m = (lo + hi) >>> 1; if (arr[m] <= x) lo = m + 1; else hi = m; }
  return lo;
}

interface ComputedOverlays {
  segments: LevelSegment[];
  boxes: ProbabilityBox[];
  midBands: MidBand[];
  labels: Label[];
  quarters: QuarterRange[];
}

function computeOverlays(
  bars: Bar[],
  levels: LevelLine[],
  model: string,
  outcome: string,
): ComputedOverlays {
  const segments: LevelSegment[] = [];
  const boxes: ProbabilityBox[] = [];
  const midBands: MidBand[] = [];
  const labels: Label[] = [];

  const quarters = findQuarterRanges(bars);
  if (!levels.length || !quarters.length) return { segments, boxes, midBands, labels, quarters };

  const grouped = groupScenarioLines(levels);
  const barTimes = bars.map(b => b.time);
  const isProLike = model === 'pro' || model === 'beta' || model === 'overlay';

  for (let i = quarters.length - 1; i >= 0; i--) {
    const r = quarters[i];
    const t1 = r.startTime + DAY_SEC;
    const t2 = r.endTime - DAY_SEC;
    if (t1 >= t2) continue;

    // Snap times to real bar times
    const i1 = lowerBound(barTimes, t1);
    const i2 = upperBound(barTimes, t2) - 1;
    if (i1 < 0 || i2 < 0 || i1 >= barTimes.length || i2 >= barTimes.length || i1 >= i2) continue;
    const st1 = barTimes[i1];
    const st2 = barTimes[i2];

    // Determine scenario
    let scenario: OutcomeKey;
    if (model === 'simple') {
      const detected = outcomeForRange(r, bars);
      let key: 'LONG_TRUE' | 'SHORT_TRUE' | null = null;
      if (detected.startsWith('LONG')) key = 'LONG_TRUE';
      else if (detected.startsWith('SHORT')) key = 'SHORT_TRUE';
      if (!key) key = grouped.LONG_TRUE.length ? 'LONG_TRUE' : (grouped.SHORT_TRUE.length ? 'SHORT_TRUE' : null);
      if (!key) continue;
      scenario = key;
    } else {
      const isLatestQuarter = i === quarters.length - 1;
      if (isProLike && outcome && outcome !== 'AUTO' && isLatestQuarter) {
        scenario = outcome as OutcomeKey;
      } else {
        scenario = outcomeForRange(r, bars);
      }
    }

    let midPct = 0;

    if (scenario !== 'NONE') {
      const scenarioLines = grouped[scenario] || [];
      const parsed = parseScenarioFixed(scenarioLines);
      midPct = Number.isFinite(parsed.midPct) ? parsed.midPct : 0;

      if (model === 'simple') {
        // Simple model: individual level lines
        for (const line of scenarioLines) {
          const price = r.mid * (1 + (line.value as number) / 100);
          const nameU = (line.name || '').toUpperCase();
          const isHigh = /HIGH|UPPER/.test(nameU);
          const isLow = /LOW(?!ER)?|LOWER/.test(nameU);
          const is90 = /(?:_|)(90|9)\b/.test(nameU);
          const isSpecial90 = is90 && (isHigh || isLow);

          const highColor = '#2563eb';
          const lowColor = '#7c3aed';
          let color = isHigh ? highColor : lowColor;
          if (isSpecial90) {
            const alpha = isHigh ? 0.8 : 0.7;
            color = hexA(color, alpha);
          }
          const lineWidth = isSpecial90 ? 2 : 1;
          const dashed = isSpecial90 ? false : true;

          segments.push({
            t1: st1, t2: st2, price, pct: line.value as number,
            color, lineWidth, dashed,
            label: (() => {
              const m = /_(\d+)\b/.exec(nameU);
              return m ? `${m[1]} %` : `${Math.round(Math.abs(line.value as number))} %`;
            })(),
          });

          labels.push({
            t: quarterLeftTime(st1, bars, 0),
            price,
            text: (() => {
              const m = /_(\d+)\b/.exec(nameU);
              return m ? `${m[1]} %` : `${Math.round(Math.abs(line.value as number))} %`;
            })(),
            color,
            dy: isHigh ? -10 : 10,
            dx: 0,
          });
        }
      } else {
        // Pro/Beta/Overlay: boxes + labels
        const boxColors = [BOX_PURPLE, BOX_PURPLE, BOX_BLUE, BOX_BLUE];
        for (let j = 0; j < parsed.pairs.length; j++) {
          const [loPct, hiPct] = parsed.pairs[j];
          const priceLow = r.mid * (1 + loPct / 100);
          const priceHigh = r.mid * (1 + hiPct / 100);
          const colors = boxColors[Math.min(j, boxColors.length - 1)];
          boxes.push({ t1: st1, t2: st2, priceLow, priceHigh, ...colors });
        }

        // Labels at indices 1,2,3,7,8,9
        const idxMap = levelIndexMap(scenarioLines);
        const indices = [1, 2, 3, 7, 8, 9];
        const tLeft = quarterLeftTime(st1, bars, 0);
        for (const idx of indices) {
          const e = idxMap[idx];
          if (!e) continue;
          const price = r.mid * (1 + e.pct / 100);
          const isUpper = idx > 5;
          labels.push({
            t: tLeft,
            price,
            text: LABELS_BY_INDEX[idx] || '',
            color: isUpper ? LEVEL_BLUE : LEVEL_PURPLE,
            dy: isUpper ? -10 : 10,
            dx: 0,
          });
        }
      }
    }

    // Mid band (pro/overlay/beta only)
    if (model !== 'simple') {
      const midPrice = r.mid * (1 + midPct / 100);
      midBands.push({ t1: st1, t2: st2, price: midPrice });
    }
  }

  return { segments, boxes, midBands, labels, quarters };
}

// ============================================================================
// PROPS
// ============================================================================

export interface TerminalChartProps {
  symbol: string;
  source: 'demo' | 'live';
  model: 'simple' | 'pro' | 'overlay' | 'beta';
  outcome?: 'AUTO' | 'LONG_TRUE' | 'LONG_FALSE' | 'SHORT_TRUE' | 'SHORT_FALSE';
  overlaySymbol?: string;
  onPriceInfo?: (info: { close: number; change: number; changePct: number }) => void;
  bars: Bar[];
  levels: LevelLine[];
  loading?: boolean;
  error?: string | null;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function TerminalChart({
  symbol,
  source,
  model,
  outcome = 'AUTO',
  bars,
  levels,
  loading,
  error,
  onPriceInfo,
}: TerminalChartProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const disposedRef = useRef(false);

  // Level line series: one per segment
  const levelSeriesRef = useRef<ISeriesApi<'Line'>[]>([]);

  // Canvas overlay for boxes, mid-bands, labels
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const overlaysDataRef = useRef<ComputedOverlays>({
    segments: [], boxes: [], midBands: [], labels: [], quarters: [],
  });

  const drawRafRef = useRef<number>(0);

  // ========================================================================
  // OVERLAY CANVAS DRAWING (boxes, mid-bands, labels)
  // ========================================================================

  const drawOverlay = useCallback(() => {
    const cv = overlayRef.current;
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!cv || !chart || !series) return;

    const host = hostRef.current;
    if (!host) return;

    const dpr = window.devicePixelRatio || 1;
    const w = host.clientWidth;
    const h = host.clientHeight;

    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
    }

    const ctx = cv.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const rightW = chart.priceScale('right')?.width?.() ?? 0;
    const timeH = chart.timeScale()?.height?.() ?? 0;
    const paneW = Math.max(0, w - rightW);
    const paneH = Math.max(0, h - timeH);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, paneW, paneH);
    ctx.clip();

    const ts = chart.timeScale();
    const vr = ts.getVisibleRange();
    if (!vr) { ctx.restore(); return; }

    const data = overlaysDataRef.current;

    // Draw boxes
    for (const bx of data.boxes) {
      if (bx.t2 < (vr.from as number) || bx.t1 > (vr.to as number)) continue;
      const x1 = ts.timeToCoordinate(bx.t1 as UTCTimestamp);
      const x2 = ts.timeToCoordinate(bx.t2 as UTCTimestamp);
      const y1 = series.priceToCoordinate(bx.priceHigh);
      const y2 = series.priceToCoordinate(bx.priceLow);
      if (x1 == null || x2 == null || y1 == null || y2 == null) continue;

      const left = Math.min(x1, x2), right = Math.max(x1, x2);
      const top = Math.min(y1, y2), bottom = Math.max(y1, y2);
      const bw = Math.max(1, Math.round(right - left));
      const bh = Math.max(1, Math.round(bottom - top));

      // Fill
      ctx.fillStyle = bx.fill;
      ctx.fillRect(Math.round(left), Math.round(top), bw, bh);

      // Top/bottom borders
      const edge = darkenColor(bx.stroke, 0.72, 1);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(Math.round(left) + 0.5, Math.round(top) + 0.5);
      ctx.lineTo(Math.round(left + bw) - 0.5, Math.round(top) + 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(Math.round(left) + 0.5, Math.round(top + bh) - 0.5);
      ctx.lineTo(Math.round(left + bw) - 0.5, Math.round(top + bh) - 0.5);
      ctx.stroke();
    }

    // Draw mid bands
    for (const mb of data.midBands) {
      if (mb.t2 < (vr.from as number) || mb.t1 > (vr.to as number)) continue;
      const x1 = ts.timeToCoordinate(mb.t1 as UTCTimestamp);
      const x2 = ts.timeToCoordinate(mb.t2 as UTCTimestamp);
      const y = series.priceToCoordinate(mb.price);
      if (x1 == null || x2 == null || y == null) continue;

      let left = Math.min(x1, x2);
      let right = Math.max(x1, x2);
      if (right - left < 2) right = left + 2;

      const top2 = (y as number) - MID_BAND_PX / 2;
      const mh = Math.max(1, MID_BAND_PX);

      ctx.strokeStyle = MID_BAND_EDGE;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(Math.round(left) + 0.5, Math.round(top2) + 0.5);
      ctx.lineTo(Math.round(right) - 0.5, Math.round(top2) + 0.5);
      ctx.moveTo(Math.round(left) + 0.5, Math.round(top2 + mh) - 0.5);
      ctx.lineTo(Math.round(right) - 0.5, Math.round(top2 + mh) - 0.5);
      ctx.stroke();
    }

    // Draw labels
    ctx.font = `bold 10px 'SF Mono', 'JetBrains Mono', 'Fira Code', ui-monospace, monospace`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    const EDGE_MARGIN = 12;
    const PAD = 3;
    const TEXT_H = 12;

    type Cand = { x: number; y: number; text: string; color: string };
    const cands: Cand[] = [];
    for (const lb of data.labels) {
      if (lb.t < (vr.from as number) || lb.t > (vr.to as number)) continue;
      const x0 = ts.timeToCoordinate(lb.t as UTCTimestamp);
      const yLine = series.priceToCoordinate(lb.price);
      if (x0 == null || yLine == null) continue;

      const y = (yLine as number) + (lb.dy || 0);
      if (y < EDGE_MARGIN || y > paneH - EDGE_MARGIN) continue;
      let x = (x0 as number) + (lb.dx ?? 8);
      x = Math.max(6, Math.min(x, paneW - 6));
      cands.push({ x, y, text: lb.text, color: lb.color });
    }

    cands.sort((a, b) => (a.x - b.x) || (a.y - b.y));

    type Rect = { x: number; y: number; w: number; h: number };
    const placed: { rect: Rect; c: Cand }[] = [];
    const intersects = (a: Rect, b: Rect, pad = PAD) =>
      !(a.x + a.w + pad < b.x || b.x + b.w + pad < a.x || a.y + a.h + pad < b.y || b.y + b.h + pad < a.y);

    for (const c of cands) {
      const tw = Math.ceil(ctx.measureText(c.text).width);
      const rect: Rect = { x: Math.round(c.x), y: Math.round(c.y - TEXT_H / 2), w: tw, h: TEXT_H };
      if (rect.y < EDGE_MARGIN || rect.y + rect.h > paneH - EDGE_MARGIN) continue;
      if (placed.some(p => intersects(p.rect, rect))) continue;
      placed.push({ rect, c });
    }

    for (const { rect, c } of placed) {
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, rect.x, rect.y + TEXT_H / 2);
    }

    ctx.restore();
  }, []);

  const scheduleDraw = useCallback(() => {
    if (drawRafRef.current) cancelAnimationFrame(drawRafRef.current);
    drawRafRef.current = requestAnimationFrame(() => {
      drawRafRef.current = 0;
      drawOverlay();
    });
  }, [drawOverlay]);

  // ========================================================================
  // CHART MOUNT/UNMOUNT
  // ========================================================================

  useEffect(() => {
    if (typeof window === 'undefined' || !hostRef.current) return;
    const el = hostRef.current;

    const rect = el.getBoundingClientRect();
    const width = Math.max(rect.width || 600, 200);
    const height = Math.max(rect.height || 400, 200);

    const chart = createChart(el, {
      ...CHART_OPTIONS,
      width,
      height,
    });

    const series = chart.addCandlestickSeries({
      upColor: '#00d68f',
      downColor: '#ff4757',
      wickUpColor: '#00d68f',
      wickDownColor: '#ff4757',
      borderUpColor: '#00d68f',
      borderDownColor: '#ff4757',
      borderVisible: true,
      priceLineVisible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = series;
    disposedRef.current = false;

    // Resize observer
    const ro = new ResizeObserver(([entry]) => {
      if (disposedRef.current) return;
      const { width: w, height: h } = entry.contentRect;
      try {
        chart.resize(Math.max(0, Math.floor(w)), Math.max(0, Math.floor(h)));
      } catch { /* ignore post-dispose */ }
      scheduleDraw();
    });
    ro.observe(el);

    // Subscribe to visible range changes for overlay redraw
    const ts = chart.timeScale();
    const onRange = () => scheduleDraw();
    ts.subscribeVisibleTimeRangeChange(onRange);

    // Mouse events for overlay redraw
    const onWheel = () => scheduleDraw();
    const onMouseMove = () => scheduleDraw();
    el.addEventListener('wheel', onWheel, { passive: true });
    el.addEventListener('mousemove', onMouseMove);

    // Create overlay canvas
    const cv = document.createElement('canvas');
    cv.style.position = 'absolute';
    cv.style.inset = '0';
    cv.style.pointerEvents = 'none';
    cv.style.zIndex = '2';
    el.appendChild(cv);
    overlayRef.current = cv;

    return () => {
      disposedRef.current = true;
      try { ts.unsubscribeVisibleTimeRangeChange(onRange); } catch { /* ignore */ }
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('mousemove', onMouseMove);
      ro.disconnect();
      cv.remove();
      if (drawRafRef.current) cancelAnimationFrame(drawRafRef.current);

      // Clean up level series
      for (const ls of levelSeriesRef.current) {
        try { chart.removeSeries(ls); } catch { /* ignore */ }
      }
      levelSeriesRef.current = [];

      try { chart.remove(); } catch { /* ignore */ }
      chartRef.current = null;
      candleSeriesRef.current = null;
      overlayRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ========================================================================
  // DATA UPDATE
  // ========================================================================

  useEffect(() => {
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!chart || !series || disposedRef.current) return;

    // Clean up old level series
    for (const ls of levelSeriesRef.current) {
      try { chart.removeSeries(ls); } catch { /* ignore */ }
    }
    levelSeriesRef.current = [];

    if (!bars.length) {
      series.setData([]);
      overlaysDataRef.current = { segments: [], boxes: [], midBands: [], labels: [], quarters: [] };
      scheduleDraw();
      return;
    }

    // Set candle data
    const candleData = bars.map(b => ({
      time: b.time as UTCTimestamp,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));
    series.setData(candleData);

    // Show last N bars
    const N = Math.min(220, bars.length);
    const last = bars.length - 1;
    const fromIdx = Math.max(0, last - (N - 1));
    const ts = chart.timeScale();
    ts.setVisibleRange({
      from: bars[fromIdx].time as UTCTimestamp,
      to: bars[last].time as UTCTimestamp,
    });
    ts.scrollToRealTime();

    // Compute overlays
    const overlays = computeOverlays(bars, levels, model, outcome);
    overlaysDataRef.current = overlays;

    // Create level line series for segments (simple model lines)
    for (const seg of overlays.segments) {
      try {
        const ls = chart.addLineSeries({
          color: seg.color,
          lineWidth: seg.lineWidth as 1 | 2 | 3,
          lineStyle: seg.dashed ? 2 : 0,
          lineType: LineType.Simple,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
          autoscaleInfoProvider: () => ({
            priceRange: {
              minValue: Number.POSITIVE_INFINITY,
              maxValue: Number.NEGATIVE_INFINITY,
            },
            margins: { above: 0, below: 0 },
          }),
        });
        ls.setData([
          { time: seg.t1 as UTCTimestamp, value: seg.price },
          { time: seg.t2 as UTCTimestamp, value: seg.price },
        ]);
        levelSeriesRef.current.push(ls);
      } catch { /* ignore if chart disposed */ }
    }

    // Reset autoscale to candles only
    chart.priceScale('right').applyOptions({ autoScale: true });

    // Emit price info
    if (onPriceInfo && bars.length >= 2) {
      const lastBar = bars[bars.length - 1];
      const prevBar = bars[bars.length - 2];
      const change = lastBar.close - prevBar.close;
      const changePct = prevBar.close ? (change / prevBar.close) * 100 : 0;
      onPriceInfo({ close: lastBar.close, change, changePct });
    }

    // Schedule overlay draw
    requestAnimationFrame(() => {
      scheduleDraw();
    });
  }, [bars, levels, model, outcome, symbol, scheduleDraw, onPriceInfo]);

  // ========================================================================
  // RENDER
  // ========================================================================

  if (error) {
    return (
      <div className="flex items-center justify-center h-full w-full" style={{ background: '#0a0a0a' }}>
        <span className="text-[12px] font-mono text-[#ff4757]">{error}</span>
      </div>
    );
  }

  return (
    <div
      ref={hostRef}
      className="relative w-full h-full"
      style={{ background: '#0a0a0a' }}
    >
      {loading && !bars.length && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <span className="text-[11px] font-mono text-[#555] animate-pulse">Loading {symbol}...</span>
        </div>
      )}
    </div>
  );
}
