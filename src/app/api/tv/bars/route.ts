import { NextRequest } from "next/server";
import path from "path";
import { promises as fs } from "fs";
export const runtime = "nodejs";

type Ohlc = { time: string; open:number; high:number; low:number; close:number; volume?:number };

// helper to parse "YYYY-MM-DD" as UTC ms
const toMs = (d: string) => Date.parse(d + "T00:00:00Z");

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") || "").toUpperCase();
  const res = (url.searchParams.get("res") || "1D").toUpperCase();
  const from = Number(url.searchParams.get("from") || 0); // seconds
  const to = Number(url.searchParams.get("to") || Math.floor(Date.now()/1000));

  if (res !== "1D" && res !== "D" && res !== "DAY") {
    // keep MVP simple: only daily from mocks
    return Response.json([], { status: 200 });
  }

  try {
    const file = path.join(process.cwd(), "public", "mock", "ohlcv", `${symbol}.json`);
    const json = await fs.readFile(file, "utf-8");
    const arr: Ohlc[] = JSON.parse(json);

    const bars = arr
      .map(b => ({
        time: toMs(b.time), // ms
        open: b.open, high: b.high, low: b.low, close: b.close,
        volume: b.volume ?? 0,
      }))
      .filter(b => (b.time/1000) >= from && (b.time/1000) <= to);

    return Response.json(bars);
  } catch (e) {
    return Response.json([], { status: 200 });
  }
}