import { NextRequest } from "next/server";
import path from "path";
import { promises as fs } from "fs";

export const runtime = "nodejs"; // allow fs

type OhlcvRow = { time: string; open: number; high: number; low: number; close: number };
type AssetEntry = { asset_name: string; file_path: string };

const DEFAULT_OHLCV_SOURCE = (process.env.QPP_OHLCV_SOURCE || "live").toLowerCase();
const DEMO_DIR = path.join(process.cwd(), "public", "mock", "ohlcv");
const BACKEND_DIR = path.join(process.cwd(), "backend");
const ASSETS_PATH = path.join(BACKEND_DIR, "assets.json");
const SYMBOL_ALIASES: Record<string, string> = {
  BTCUSD: "BTC",
};

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

async function loadAssetsMap(): Promise<Map<string, string>> {
  const entries = await readJsonFile<AssetEntry[]>(ASSETS_PATH);
  const map = new Map<string, string>();
  for (const entry of entries || []) {
    if (!entry?.asset_name || !entry?.file_path) continue;
    const resolved = path.isAbsolute(entry.file_path)
      ? entry.file_path
      : path.resolve(BACKEND_DIR, entry.file_path);
    map.set(entry.asset_name.toUpperCase(), resolved);
  }
  return map;
}

function parseCsvOhlcv(csv: string): OhlcvRow[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idxTime = headers.indexOf("time") >= 0 ? headers.indexOf("time") : headers.indexOf("date");
  const idxOpen = headers.indexOf("open");
  const idxHigh = headers.indexOf("high");
  const idxLow = headers.indexOf("low");
  const idxClose = headers.indexOf("close");

  if (idxTime < 0 || idxOpen < 0 || idxHigh < 0 || idxLow < 0 || idxClose < 0) return [];

  const out: OhlcvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(",");
    const time = parts[idxTime];
    const open = Number(parts[idxOpen]);
    const high = Number(parts[idxHigh]);
    const low = Number(parts[idxLow]);
    const close = Number(parts[idxClose]);
    if (!time || !Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
      continue;
    }
    out.push({ time, open, high, low, close });
  }
  return out;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawSymbol = (searchParams.get("symbol") || "SPY").toUpperCase();
  const source = (searchParams.get("source") || DEFAULT_OHLCV_SOURCE).toLowerCase();

  const symbol = SYMBOL_ALIASES[rawSymbol] || rawSymbol;

  try {
    if (source === "demo") {
      const file = path.join(DEMO_DIR, `${symbol}.json`);
      const json = await fs.readFile(file, "utf-8");
      const data = JSON.parse(json);
      return Response.json(data, {
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=60, s-maxage=60"
        }
      });
    }

    const assetsMap = await loadAssetsMap();
    const filePath = assetsMap.get(symbol);
    if (!filePath) {
      return Response.json([], { status: 404 });
    }

    const csv = await fs.readFile(filePath, "utf-8");
    const rows = parseCsvOhlcv(csv);
    return Response.json(rows, {
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=60, s-maxage=60"
      }
    });
  } catch (error) {
    console.error("OHLCV load error:", error);
    return Response.json([], { status: 500 });
  }
}
