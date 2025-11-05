import type { UTCTimestamp } from 'lightweight-charts';

type AnyBar = {
  time: number | string | Date;
  open: number; high: number; low: number; close: number;
  volume?: number;
};

function toSec(t: number | string | Date): number {
  if (typeof t === 'number') return t > 10_000_000_000 ? Math.floor(t / 1000) : t; // ms → s
  if (t instanceof Date) return Math.floor(t.getTime() / 1000);
  const d = new Date(t); return Math.floor(d.getTime() / 1000);
}

export function normalizeBars(raw: AnyBar[]): { time: UTCTimestamp; open:number; high:number; low:number; close:number; volume?:number }[] {
  if (!Array.isArray(raw)) return [];
  const out: AnyBar[] = raw
    .filter(r => Number.isFinite(+r.open) && Number.isFinite(+r.high) && Number.isFinite(+r.low) && Number.isFinite(+r.close))
    .map(r => ({ ...r, time: toSec(r.time) }))
    .sort((a,b) => (a.time as number) - (b.time as number));

  // dedupe same timestamp
  const dedup: AnyBar[] = [];
  let last: number | null = null;
  for (const b of out) {
    const t = b.time as number;
    if (last === t) { 
      dedup[dedup.length - 1] = { 
        ...dedup[dedup.length - 1], 
        ...b, 
        close: b.close, 
        high: Math.max(dedup[dedup.length-1].high, b.high), 
        low: Math.min(dedup[dedup.length-1].low, b.low), 
        volume: (dedup[dedup.length-1].volume ?? 0) + (b.volume ?? 0) 
      }; 
    }
    else { 
      dedup.push(b); 
      last = t; 
    }
  }

  return dedup.map(b => ({
    time: b.time as UTCTimestamp,
    open: +b.open, high: +b.high, low: +b.low, close: +b.close, volume: b.volume ? +b.volume : undefined,
  }));
}





