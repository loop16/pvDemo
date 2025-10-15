import type { UTCTimestamp, SeriesMarker } from 'lightweight-charts';

export type Bar = {
  time: UTCTimestamp; open: number; high: number; low: number; close: number; volume?: number;
};

export type QuarterRange = {
  qkey: string;
  fridayIdx: number;
  prevIdx: number;
  startTime: UTCTimestamp;
  endTime: UTCTimestamp;
  high: number; low: number; mid: number;
  confirm?: { side: 'LONG'|'SHORT'; time: UTCTimestamp };
  falsed?: { time: UTCTimestamp };
};

const DAY = 24 * 60 * 60;

function quarterOf(d: Date) {
  const m = d.getUTCMonth();
  return Math.floor(m / 3) + 1;
}
function isFriday(ts: number) {
  return new Date(ts * 1000).getUTCDay() === 5;
}

export function findQuarterRanges(bars: Bar[]): QuarterRange[] {
  if (!bars?.length) return [];
  const byQ = new Map<string, number[]>();
  bars.forEach((b, i) => {
    const d = new Date((b.time as number) * 1000);
    const q = quarterOf(d);
    const key = `${d.getUTCFullYear()}-Q${q}`;
    if (!byQ.has(key)) byQ.set(key, []);
    byQ.get(key)!.push(i);
  });

  const qkeys = Array.from(byQ.keys()).sort();
  const ranges: QuarterRange[] = [];
  for (const key of qkeys) {
    const idxs = byQ.get(key)!;
    const firstFriIdx = idxs.find(i => isFriday(bars[i].time as number));
    if (firstFriIdx === undefined) continue;
    // Edge case: if the first Friday of the quarter lands on the 1st day of the quarter,
    // prefer using the previous day's candle (which may belong to the prior quarter).
    // Example: Friday, April 1st → use Thursday, March 31st.
    let prevIdx = Math.max(firstFriIdx - 1, idxs[0]);
    {
      const friTs = bars[firstFriIdx].time as number;
      const d = new Date(friTs * 1000);
      const isFirstDayOfQuarter = d.getUTCDate() === 1 && (d.getUTCMonth() % 3 === 0);
      if (isFirstDayOfQuarter && firstFriIdx > 0) {
        prevIdx = firstFriIdx - 1;
      }
    }

    const high = Math.max(bars[prevIdx].high, bars[firstFriIdx].high);
    const low  = Math.min(bars[prevIdx].low,  bars[firstFriIdx].low);
    const mid  = (high + low) / 2;

    const thisPos = qkeys.indexOf(key);
    const hasNext = thisPos < qkeys.length - 1;
    let endTime = (bars[idxs[idxs.length - 1]].time as number) + DAY;
    if (hasNext) {
      const nextIdxs = byQ.get(qkeys[thisPos + 1])!;
      const nextFri = nextIdxs.find(i => isFriday(bars[i].time as number)) ?? nextIdxs[0];
      endTime = bars[nextFri].time as number;
    }

    let confirm: QuarterRange['confirm'] | undefined;
    let falsed: QuarterRange['falsed'] | undefined;
    for (let i = firstFriIdx + 1; i < bars.length; i++) {
      const t = bars[i].time as number;
      if (t >= endTime) break;
      if (!confirm) {
        if (bars[i].close > high) confirm = { side: 'LONG', time: bars[i].time } as any;
        else if (bars[i].close < low) confirm = { side: 'SHORT', time: bars[i].time } as any;
      } else if (!falsed) {
        if (confirm.side === 'LONG' && bars[i].close < low) falsed = { time: bars[i].time } as any;
        if (confirm.side === 'SHORT' && bars[i].close > high) falsed = { time: bars[i].time } as any;
      }
    }

    ranges.push({
      qkey: key,
      fridayIdx: firstFriIdx,
      prevIdx,
      startTime: bars[firstFriIdx].time,
      endTime: endTime as UTCTimestamp,
      high, low, mid, confirm, falsed,
    });
  }
  return ranges;
}

export function markersFromRanges(_ranges: QuarterRange[]): SeriesMarker<UTCTimestamp>[] {
  // Icons/labels disabled per request
  return [];
}



