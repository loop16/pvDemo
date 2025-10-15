import type { LineData, WhitespaceData, UTCTimestamp } from 'lightweight-charts';

const DAY: number = 24 * 60 * 60; // seconds in a day
const EPS: number = 1; // 1-second gap

export function buildLevelSegments(
  ranges: { startTime: UTCTimestamp; endTime: UTCTimestamp; mid: number }[],
  levelPcts: number[]
): Record<number, (LineData<UTCTimestamp> | WhitespaceData<UTCTimestamp>)[]> {
  const out: Record<number, (LineData<UTCTimestamp> | WhitespaceData<UTCTimestamp>)[]> = {};
  for (const pct of levelPcts) out[pct] = [] as any;

  for (const r of ranges) {
    // Exclude the defining Friday and the next quarter's Friday
    const qStart = (r.startTime as number) + DAY;
    const qEnd = (r.endTime as number) - DAY;
    if (qStart >= qEnd) continue;

    for (const pct of levelPcts) {
      const price = r.mid * (1 + pct / 100);
      out[pct].push(
        // whitespace BEFORE segment to break from previous quarter
        { time: (qStart - EPS) as UTCTimestamp } as WhitespaceData<UTCTimestamp>,
        // horizontal segment (simple line)
        { time: qStart as UTCTimestamp, value: price },
        { time: (qEnd - EPS) as UTCTimestamp, value: price },
        // whitespace AFTER segment to break into next quarter
        { time: qEnd as UTCTimestamp } as WhitespaceData<UTCTimestamp>,
      );
    }
  }
  return out;
}


