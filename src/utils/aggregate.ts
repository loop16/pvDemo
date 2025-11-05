export type Bar = { time: number; open:number; high:number; low:number; close:number; volume?: number };

// Get tz offset (sec) for an IANA zone at a given UTC ts (DST aware)
function tzOffsetSeconds(utcSec: number, timeZone: string): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone, year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false,
    });
    const parts = dtf.formatToParts(new Date(utcSec * 1000));
    const map: Record<string,string> = {};
    for (const p of parts) map[p.type] = p.value;
    const asLocalUTC =
      Date.UTC(+map.year, +map.month - 1, +map.day, +map.hour, +map.minute, +map.second) / 1000;
    return asLocalUTC - utcSec;
  } catch { return 0; }
}

// Start of week (Mon=1) in given time zone
function startOfWeekUTC(utcSec: number, timeZone: string, weekStartsOn = 1): number {
  const off = tzOffsetSeconds(utcSec, timeZone);
  const d = new Date((utcSec + off) * 1000);
  const day = d.getUTCDay(); // 0..6, Sun=0
  const diff = ( (day - weekStartsOn + 7) % 7 );
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0,0,0,0);
  // convert back to UTC seconds
  return Math.floor(d.getTime()/1000 - off);
}

export function aggregateToWeekly(bars: Bar[], timeZone = 'America/New_York'): Bar[] {
  if (!bars?.length) return [];
  const out: Bar[] = [];
  let cur: Bar | null = null;
  let curKey: number | null = null;

  for (const b of bars) {
    const key = startOfWeekUTC(b.time as number, timeZone);
    if (curKey === null || key !== curKey) {
      if (cur) out.push(cur);
      curKey = key;
      cur = { time: key, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume ?? 0 };
    } else if (cur) {
      cur.high = Math.max(cur.high, b.high);
      cur.low  = Math.min(cur.low, b.low);
      cur.close = b.close;
      cur.volume = (cur.volume ?? 0) + (b.volume ?? 0);
    }
  }
  if (cur) out.push(cur);
  return out;
}





