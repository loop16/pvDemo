import { NextRequest } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { Readable } from "stream";

export const runtime = "nodejs";

/* ── Types ─────────────────────────────────────────────── */

type OhlcvBar = {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
};
type RawOhlcvRow = {
  time?: string | number;
  open?: number | string | null;
  high?: number | string | null;
  low?: number | string | null;
  close?: number | string | null;
};
type LevelLineLike = {
  name?: string;
  value?: number | string;
  style?: string;
  color?: string;
};
type LevelsEntry = {
  symbol?: string;
  asof?: string;
  daily?: { lines?: LevelLineLike[] };
  meta?: Record<string, unknown>;
};

type AssetClass = "equity" | "futures" | "crypto" | "fx" | "index" | "etf";

type CombinedAssetEntry = {
  asset_name: string;
  file_path: string;
  tv_symbol: string;
  tv_exchange: string | string[];
};

type ModelType = "pro" | "simple" | "beta";

type MoverRow = {
  symbol: string;
  price: number;
  prevClose: number;
  changePct: number;
  mid: number;
  vsMid: number;
  zone: string;
  magnitude: number;
  direction: "above" | "below";
  assetClass: AssetClass;
  lastQCloseZone?: string;
  scenario: string;
  daysSinceChange: number | null;
  [key: string]: unknown;
};

type CachedResult = {
  movers: MoverRow[];
  timestamp: number;
};

type SymbolWithClass = {
  symbol: string;
  assetClass: AssetClass;
  filePath?: string; // resolved file path for live mode
};

const BENCHMARK_SYMBOL = "SPX";
const BETA_LOOKBACK = 1250;
const BETA_CLAMP = 5;

/* ── Config ────────────────────────────────────────────── */

const DEMO_SYMBOLS = ["SPX", "NQ", "BTCUSD", "CL", "GC"];
const BATCH_SIZE = 500; // Higher parallelism for I/O-bound reads
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes — data updates nightly
const STALE_SERVE_MS = 60 * 60 * 1000; // Serve stale cache up to 1 hour while recomputing
const TAIL_BYTES = 32_768; // Read last 32 KB of each CSV (~400 rows, covers 1.5+ years for reliable quarter detection)

const LEVELS_LOCAL_DIR = path.join(process.cwd(), "public", "mock", "levels");
const DEMO_OHLCV_DIR = path.join(process.cwd(), "public", "mock", "ohlcv");
const COMBINED_ASSETS_PATH = path.join(process.cwd(), "backend", "combined_daily_assets.json");
const ASSETS_BASE_DIR = path.join(process.cwd(), "backend");

const DEFAULT_LEVELS_SOURCE = (process.env.QPP_LEVELS_SOURCE || "wasabi").toLowerCase();
const DEFAULT_OHLCV_SOURCE = (process.env.QPP_OHLCV_SOURCE || "live").toLowerCase();
const WASABI_PREFIX = (process.env.WASABI_PREFIX || "levels").replace(/^\/+|\/+$/g, "");

const WASABI_OHLCV_DIR = "ohlcv/symbols";

const OHLCV_ALIASES: Record<string, string> = {
  BTCUSD: "BTC",
  CL: "CL1!",
  GC: "GC1!",
  NQ: "NQ1!",
};

/* ── In-memory cache (per model) ──────────────────────── */

const moversCacheByModel: Record<string, CachedResult | null> = {};
const recomputeInProgressByModel: Record<string, boolean> = {};

/* ── In-memory cache: levels data (expensive Wasabi/disk load) ── */
type LevelsCacheEntry = { data: Record<string, LevelsEntry>; timestamp: number };
const levelsCacheByModel: Record<string, LevelsCacheEntry> = {};

/* ── In-memory cache: accessible symbols (1000+ fs.access calls) ── */
type AccessibleSymbolsCacheEntry = { symbols: SymbolWithClass[]; timestamp: number };
let accessibleSymbolsCache: AccessibleSymbolsCacheEntry | null = null;
const ACCESSIBLE_SYMBOLS_TTL_MS = 10 * 60 * 1000; // 10 minutes

/* ── Asset classification ──────────────────────────────── */

const CRYPTO_EXCHANGES = new Set(["BINANCE", "BINANCEUS", "COINBASE"]);
const FUTURES_EXCHANGES = new Set(["CME_MINI", "COMEX", "NYMEX", "CBOT", "EUREX", "CME", "ICEUS"]);
const FX_EXCHANGES = new Set(["FX_IDC", "OANDA"]);
const INDEX_EXCHANGES = new Set(["INDEX", "DJI"]);
const INDEX_SYMBOLS = new Set(["SPX", "NDX", "RUT", "VIX", "DXY"]);

function classifyAsset(entry: CombinedAssetEntry): AssetClass {
  const exchanges = Array.isArray(entry.tv_exchange)
    ? entry.tv_exchange
    : [entry.tv_exchange];
  const filePath = entry.file_path || "";
  const symbol = entry.asset_name || "";

  // Use file_path prefix as the primary classifier since exchange arrays overlap
  if (/ETF_/i.test(filePath)) return "etf";
  if (/CRYPTO_/i.test(filePath)) return "crypto";
  if (/FX_/i.test(filePath)) return "fx";
  if (/INDEX_/i.test(filePath)) return "index";
  if (/FUTURES_|CME_MINI_|CME_|NYMEX_|COMEX_|CBOT_|ICEUS_|CBOT_MINI_/i.test(filePath)) return "futures";

  // Fallback to exchange-based classification
  for (const ex of exchanges) {
    if (!ex) continue;
    if (CRYPTO_EXCHANGES.has(ex)) return "crypto";
    if (FUTURES_EXCHANGES.has(ex)) return "futures";
    if (FX_EXCHANGES.has(ex)) return "fx";
    if (INDEX_EXCHANGES.has(ex)) return "index";
  }

  // Special index symbols with TVC exchange
  if (INDEX_SYMBOLS.has(symbol) && exchanges.includes("TVC")) return "index";

  // HSI and similar with TVC
  if (["HSI", "HSCEI"].includes(symbol)) return "index";

  // European indices with TVC
  if (["UKX", "DAX", "CAC40", "EU50", "IBEX", "SMI", "AEX", "OMXS30", "OMXC25", "XJO", "NI225", "KOSPI", "NIFTY"].includes(symbol)) return "index";

  return "equity";
}

/* ── Helpers ───────────────────────────────────────────── */

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

async function streamToString(stream: unknown): Promise<string> {
  if (!stream) return "";
  if (typeof stream === "string") return stream;
  if (stream instanceof Uint8Array) return Buffer.from(stream).toString("utf-8");
  if (
    typeof (stream as { transformToString?: () => Promise<string> }).transformToString === "function"
  ) {
    return (stream as { transformToString: () => Promise<string> }).transformToString();
  }
  if (stream instanceof Readable) {
    return await new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on("error", reject);
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    });
  }
  return String(stream);
}

function shouldUseWasabi(source: string) {
  if (source === "demo" || source === "local" || source === "live") return false;
  if (DEFAULT_LEVELS_SOURCE === "local" && DEFAULT_OHLCV_SOURCE === "local") return false;
  return Boolean(
    process.env.WASABI_BUCKET &&
      process.env.WASABI_ACCESS_KEY_ID &&
      process.env.WASABI_SECRET_ACCESS_KEY,
  );
}

function buildWasabiKey(pathParts: string) {
  return WASABI_PREFIX ? `${WASABI_PREFIX}/${pathParts}` : pathParts;
}

async function readWasabiJson<T>(pathParts: string): Promise<T> {
  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const bucket = process.env.WASABI_BUCKET || "";
  const accessKeyId = process.env.WASABI_ACCESS_KEY_ID || "";
  const secretAccessKey = process.env.WASABI_SECRET_ACCESS_KEY || "";
  const endpoint = process.env.WASABI_ENDPOINT || "https://s3.us-east-1.wasabisys.com";
  const region = process.env.WASABI_REGION || "us-east-1";

  const key = buildWasabiKey(pathParts);
  const client = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
  const resp = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const raw = await streamToString(resp.Body);
  return JSON.parse(raw) as T;
}

async function writeWasabiJson(pathParts: string, data: unknown): Promise<void> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const bucket = process.env.WASABI_BUCKET || "";
  const accessKeyId = process.env.WASABI_ACCESS_KEY_ID || "";
  const secretAccessKey = process.env.WASABI_SECRET_ACCESS_KEY || "";
  const endpoint = process.env.WASABI_ENDPOINT || "https://s3.us-east-1.wasabisys.com";
  const region = process.env.WASABI_REGION || "us-east-1";

  const key = buildWasabiKey(pathParts);
  const client = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: JSON.stringify(data),
    ContentType: "application/json",
  }));
}

/* ── Data loaders ──────────────────────────────────────── */

let combinedAssetsCache: CombinedAssetEntry[] | null = null;

async function loadCombinedAssets(): Promise<CombinedAssetEntry[]> {
  if (combinedAssetsCache) return combinedAssetsCache;
  try {
    const data = await readJsonFile<CombinedAssetEntry[]>(COMBINED_ASSETS_PATH);
    combinedAssetsCache = data;
    return data;
  } catch {
    return [];
  }
}

/**
 * Read only the HEADER + TAIL of a CSV file.
 * Instead of reading entire multi-MB files (some have 18000+ rows going back to 1951),
 * we read the first line (header) and the last TAIL_BYTES of the file.
 * This gives us ~150 recent rows — more than enough for the current quarter midpoint
 * and the last two bars for daily change.
 */
async function readCsvTail(filePath: string): Promise<string> {
  const handle = await fs.open(filePath, "r");
  try {
    const stat = await handle.stat();
    const fileSize = stat.size;

    if (fileSize <= TAIL_BYTES + 200) {
      // Small file — just read it all
      const buf = Buffer.alloc(fileSize);
      await handle.read(buf, 0, fileSize, 0);
      return buf.toString("utf-8");
    }

    // Read header (first 200 bytes is plenty for a CSV header line)
    const headerBuf = Buffer.alloc(200);
    await handle.read(headerBuf, 0, 200, 0);
    const headerStr = headerBuf.toString("utf-8");
    const headerEnd = headerStr.indexOf("\n");
    if (headerEnd < 0) {
      // No newline in first 200 bytes — malformed, read full file
      const buf = Buffer.alloc(fileSize);
      await handle.read(buf, 0, fileSize, 0);
      return buf.toString("utf-8");
    }
    const headerLine = headerStr.slice(0, headerEnd + 1);

    // Read the tail
    const tailOffset = fileSize - TAIL_BYTES;
    const tailBuf = Buffer.alloc(TAIL_BYTES);
    await handle.read(tailBuf, 0, TAIL_BYTES, tailOffset);
    const tailStr = tailBuf.toString("utf-8");

    // The first line of the tail chunk is likely a partial row — skip it
    const firstNewline = tailStr.indexOf("\n");
    const cleanTail = firstNewline >= 0 ? tailStr.slice(firstNewline + 1) : tailStr;

    return headerLine + cleanTail;
  } finally {
    await handle.close();
  }
}

function parseCsvOhlcv(csv: string): OhlcvBar[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idxTime = headers.indexOf("time") >= 0 ? headers.indexOf("time") : headers.indexOf("date");
  const idxOpen = headers.indexOf("open");
  const idxHigh = headers.indexOf("high");
  const idxLow = headers.indexOf("low");
  const idxClose = headers.indexOf("close");

  if (idxTime < 0 || idxClose < 0) return [];

  const out: OhlcvBar[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(",");
    const time = parts[idxTime];
    const open = Number(parts[idxOpen]);
    const high = Number(parts[idxHigh]);
    const low = Number(parts[idxLow]);
    const close = Number(parts[idxClose]);
    if (
      !time ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    )
      continue;
    out.push({ time, open, high, low, close });
  }
  return out;
}

function parseJsonOhlcv(rows: RawOhlcvRow[]): OhlcvBar[] {
  return rows
    .map((row) => {
      const close = Number(row?.close);
      const open = Number(row?.open);
      const high = Number(row?.high);
      const low = Number(row?.low);
      const time = row?.time;
      if (!Number.isFinite(close) || time == null) return null;
      return {
        time,
        open: Number.isFinite(open) ? open : close,
        high: Number.isFinite(high) ? high : close,
        low: Number.isFinite(low) ? low : close,
        close,
      } as OhlcvBar;
    })
    .filter((row): row is OhlcvBar => Boolean(row));
}

function normalizeDate(input: string | number): string {
  if (typeof input === "number") {
    const ms = input > 1e12 ? input : input * 1000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(input)) {
    return input.slice(0, 10);
  }
  const parsed = new Date(input);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return String(input);
}

function sortBars(bars: OhlcvBar[]): OhlcvBar[] {
  return bars.sort((a, b) => {
    const ta = normalizeDate(a.time);
    const tb = normalizeDate(b.time);
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
}

/**
 * Load OHLCV data for a symbol — optimized for movers.
 * Uses tail-read for CSV files to avoid reading multi-MB historical data.
 */
async function loadOhlcvFast(symbol: string, source: string, resolvedFilePath?: string): Promise<OhlcvBar[]> {
  const mapped = source === "demo" ? symbol : (OHLCV_ALIASES[symbol] || symbol);

  if (source === "demo") {
    const file = path.join(DEMO_OHLCV_DIR, `${mapped}.json`);
    const rows = await readJsonFile<RawOhlcvRow[]>(file);
    if (!Array.isArray(rows)) throw new Error(`Unexpected OHLCV shape for ${mapped}`);
    return sortBars(parseJsonOhlcv(rows));
  }

  // Live mode: use tail-read for CSV files
  if (resolvedFilePath) {
    try {
      const csv = await readCsvTail(resolvedFilePath);
      const rows = parseCsvOhlcv(csv);
      if (rows.length > 0) return sortBars(rows);
    } catch {}
  }

  // Wasabi fallback — used when local CSV files aren't deployed (e.g. Vercel)
  if (process.env.WASABI_BUCKET && process.env.WASABI_ACCESS_KEY_ID && process.env.WASABI_SECRET_ACCESS_KEY) {
    try {
      const rows = await readWasabiJson<RawOhlcvRow[]>(`${WASABI_OHLCV_DIR}/${mapped}.json`);
      if (Array.isArray(rows) && rows.length > 0) return sortBars(parseJsonOhlcv(rows));
    } catch {}
  }

  throw new Error(`No OHLCV data available for ${symbol}`);
}

async function loadLevelsData(source: string, model: ModelType = "pro"): Promise<Record<string, LevelsEntry>> {
  // Return in-memory cache if fresh (same TTL as movers cache — data only changes nightly)
  const cached = levelsCacheByModel[model];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // Determine which file to use based on model
  const consolidatedFileName = model === "simple" ? "basic_levels.json" : "levels.json";
  const perSymbolFileOrder = model === "simple"
    ? ["basic_levels.json"]
    : model === "beta"
      ? ["levels.json"]  // beta uses pro (SPX) levels, scaled later
      : ["levels.json", "basic_levels.json"];

  // Try consolidated file first
  let consolidated: Record<string, LevelsEntry> = {};
  try {
    if (shouldUseWasabi(source)) {
      consolidated = await readWasabiJson<Record<string, LevelsEntry>>(consolidatedFileName);
    } else {
      consolidated = await readJsonFile<Record<string, LevelsEntry>>(
        path.join(LEVELS_LOCAL_DIR, consolidatedFileName),
      );
    }
  } catch {}

  // Also load per-symbol levels from data/levels/symbols/
  const perSymbolDir = path.resolve(process.cwd(), "data", "levels", "symbols");
  try {
    const dirs = await fs.readdir(perSymbolDir);
    await Promise.allSettled(dirs.map(async (sym) => {
      if (consolidated[sym]) return; // already have it
      for (const fname of perSymbolFileOrder) {
        try {
          const filePath = path.join(perSymbolDir, sym, fname);
          const raw = await fs.readFile(filePath, "utf-8");
          const parsed = JSON.parse(raw);
          if (parsed.daily?.lines) {
            consolidated[sym] = parsed;
            break;
          } else if (typeof parsed === "object") {
            const firstKey = Object.keys(parsed)[0];
            if (firstKey && parsed[firstKey]?.daily?.lines) {
              consolidated[sym] = parsed[firstKey];
              break;
            }
          }
        } catch {}
      }
    }));
  } catch {}

  // Store in in-memory cache
  levelsCacheByModel[model] = { data: consolidated, timestamp: Date.now() };

  return consolidated;
}

/* ── Beta model: volatility ratio scaling ──────────────── */

/**
 * Compute volatility ratio: sigma_asset / sigma_SPX
 * Used to scale SPX percentage levels to equivalent asset-specific levels.
 * Requires OHLCV bars for both the asset and the benchmark (SPX).
 */
function computeVolRatioFromBars(assetBars: OhlcvBar[], benchBars: OhlcvBar[], lookback = BETA_LOOKBACK): number {
  // Build date-indexed log returns
  const assetByDate = new Map<string, number>();
  const benchByDate = new Map<string, number>();

  for (let i = 1; i < assetBars.length; i++) {
    const prev = assetBars[i - 1].close;
    const curr = assetBars[i].close;
    if (prev > 0 && curr > 0) {
      const ret = Math.log(curr / prev);
      if (Number.isFinite(ret)) {
        assetByDate.set(normalizeDate(assetBars[i].time), ret);
      }
    }
  }
  for (let i = 1; i < benchBars.length; i++) {
    const prev = benchBars[i - 1].close;
    const curr = benchBars[i].close;
    if (prev > 0 && curr > 0) {
      const ret = Math.log(curr / prev);
      if (Number.isFinite(ret)) {
        benchByDate.set(normalizeDate(benchBars[i].time), ret);
      }
    }
  }

  // Pair by common dates
  const paired: { asset: number; bench: number }[] = [];
  for (const [date, aRet] of assetByDate) {
    const bRet = benchByDate.get(date);
    if (bRet !== undefined) {
      paired.push({ asset: aRet, bench: bRet });
    }
  }

  // Take last N
  const sample = paired.slice(Math.max(0, paired.length - lookback));
  if (sample.length < 20) return 1; // not enough data

  const mean = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const sd = (arr: number[], m: number) => {
    if (arr.length < 2) return 0;
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
  };

  const rA = sample.map((p) => p.asset);
  const rB = sample.map((p) => p.bench);
  const sdA = sd(rA, mean(rA));
  const sdB = sd(rB, mean(rB));

  if (sdB < 1e-12) return 1;
  const ratio = sdA / sdB;
  // Clamp to reasonable bounds
  return Math.min(BETA_CLAMP, Math.max(1 / BETA_CLAMP, Number.isFinite(ratio) ? ratio : 1));
}

/**
 * Scale SPX pro levels by a volatility ratio to produce beta-model levels for any symbol.
 */
function scaleLevelsForBeta(spxLines: LevelLineLike[], volRatio: number): LevelLineLike[] {
  return spxLines.map((line) => {
    const pct = Number(line.value);
    if (!Number.isFinite(pct)) return { ...line };
    return { ...line, value: Number((pct * volRatio).toFixed(6)) };
  });
}

/* ── Quarter detection (server-side, mirrors client logic) ── */

function quarterOf(d: Date) {
  return Math.floor(d.getUTCMonth() / 3) + 1;
}

function isFriday(ts: number) {
  return new Date(ts * 1000).getUTCDay() === 5;
}

function toEpochSeconds(time: string | number): number {
  if (typeof time === "number") {
    return time > 1e12 ? Math.floor(time / 1000) : time;
  }
  const parsed = new Date(time + "T00:00:00Z");
  return Math.floor(parsed.getTime() / 1000);
}

const DAY = 24 * 60 * 60;

type OutcomeKey = "LONG_TRUE" | "LONG_FALSE" | "SHORT_TRUE" | "SHORT_FALSE" | "NONE";
type ScenarioKey = Exclude<OutcomeKey, "NONE">;

type QuarterRange = {
  qkey: string;
  startTime: number;
  endTime: number;
  high: number;      // first Friday range high
  low: number;       // first Friday range low
  mid: number;
  quarterHigh: number; // highest traded price in the full quarter
  quarterLow: number;  // lowest traded price in the full quarter
  prevQLastClose?: number; // previous quarter's last bar close
  prevQMid?: number;       // previous quarter's mid (for zone classification)
  prevQStartTime?: number;
  prevQEndTime?: number;
  prevQHigh?: number;
  prevQLow?: number;
};

function findCurrentQuarterMid(bars: OhlcvBar[]): QuarterRange | null {
  if (!bars?.length) return null;

  // Group by quarter
  const byQ = new Map<string, number[]>();
  bars.forEach((b, i) => {
    const ts = toEpochSeconds(b.time);
    const d = new Date(ts * 1000);
    const q = quarterOf(d);
    const key = `${d.getUTCFullYear()}-Q${q}`;
    if (!byQ.has(key)) byQ.set(key, []);
    byQ.get(key)!.push(i);
  });

  const qkeys = Array.from(byQ.keys()).sort();
  if (!qkeys.length) return null;

  // Build ranges for all quarters
  const ranges: QuarterRange[] = [];
  for (const key of qkeys) {
    const idxs = byQ.get(key)!;
    const thisPos = qkeys.indexOf(key);
    const hasNext = thisPos < qkeys.length - 1;
    let endTime = toEpochSeconds(bars[idxs[idxs.length - 1]].time) + DAY;
    if (hasNext) {
      const nextIdxs = byQ.get(qkeys[thisPos + 1])!;
      const nextFriIdx = nextIdxs.find((i) => isFriday(toEpochSeconds(bars[i].time))) ?? nextIdxs[0];
      endTime = toEpochSeconds(bars[nextFriIdx].time);
    }

    const firstFriIdx = idxs.find((i) => isFriday(toEpochSeconds(bars[i].time)));
    if (firstFriIdx === undefined) {
      // No Friday found in this quarter - use first two bars as fallback
      if (idxs.length >= 2) {
        const high = Math.max(bars[idxs[0]].high, bars[idxs[1]].high);
        const low = Math.min(bars[idxs[0]].low, bars[idxs[1]].low);
        const mid = (high + low) / 2;
        if (mid !== 0) {
          let qH = -Infinity, qL = Infinity;
          for (const idx of idxs) { qH = Math.max(qH, bars[idx].high); qL = Math.min(qL, bars[idx].low); }
          ranges.push({
            qkey: key,
            startTime: toEpochSeconds(bars[idxs[0]].time),
            endTime,
            high,
            low,
            mid,
            quarterHigh: qH,
            quarterLow: qL,
          });
        }
      }
      continue;
    }

    let prevIdx = Math.max(firstFriIdx - 1, idxs[0]);
    const friTs = toEpochSeconds(bars[firstFriIdx].time);
    const d = new Date(friTs * 1000);
    const isFirstDayOfQuarter = d.getUTCDate() === 1 && d.getUTCMonth() % 3 === 0;
    if (isFirstDayOfQuarter && firstFriIdx > 0) {
      prevIdx = firstFriIdx - 1;
    }

    const high = Math.max(bars[prevIdx].high, bars[firstFriIdx].high);
    const low = Math.min(bars[prevIdx].low, bars[firstFriIdx].low);
    const mid = (high + low) / 2;
    // Track full quarter high/low
    let qH = -Infinity, qL = Infinity;
    for (const idx of idxs) { qH = Math.max(qH, bars[idx].high); qL = Math.min(qL, bars[idx].low); }
    ranges.push({
      qkey: key,
      startTime: friTs,
      endTime,
      high,
      low,
      mid,
      quarterHigh: qH,
      quarterLow: qL,
    });
  }

  // Return the last (current) quarter range, with previous quarter's last close
  if (!ranges.length) return null;

  const current = ranges[ranges.length - 1];

  // Find previous quarter's last close
  if (ranges.length >= 2) {
    const prevRange = ranges[ranges.length - 2];
    const prevQKey = prevRange.qkey;
    const prevIdxs = byQ.get(prevQKey);
    if (prevIdxs && prevIdxs.length > 0) {
      const lastIdxInPrevQ = prevIdxs[prevIdxs.length - 1];
      current.prevQLastClose = bars[lastIdxInPrevQ].close;
      current.prevQMid = prevRange.mid;
      current.prevQStartTime = prevRange.startTime;
      current.prevQEndTime = prevRange.endTime;
      current.prevQHigh = prevRange.high;
      current.prevQLow = prevRange.low;
    }
  }

  return current;
}

/* ── Zone classification ───────────────────────────────── */

type OutcomeResult = {
  outcome: OutcomeKey;
  daysSinceChange: number | null; // trading days since last scenario transition
};

function outcomeForRange(
  range: { startTime: number; endTime: number; high: number; low: number },
  bars: OhlcvBar[],
): OutcomeKey {
  return outcomeForRangeDetailed(range, bars).outcome;
}

function outcomeForRangeDetailed(
  range: { startTime: number; endTime: number; high: number; low: number },
  bars: OhlcvBar[],
): OutcomeResult {
  let confirmed: "LONG_TRUE" | "SHORT_TRUE" | null = null;
  let swapIdx: number | null = null;
  let lastIdx = bars.length - 1;

  for (let i = 0; i < bars.length; i++) {
    const ts = toEpochSeconds(bars[i].time);
    if (ts < range.startTime || ts >= range.endTime) continue;

    if (!confirmed) {
      if (bars[i].close > range.high) confirmed = "LONG_TRUE";
      else if (bars[i].close < range.low) confirmed = "SHORT_TRUE";
      continue;
    }

    if (confirmed === "LONG_TRUE" && bars[i].close < range.low) {
      swapIdx = i;
      // Days ago = distance from swap bar to the last bar in the dataset
      return {
        outcome: "LONG_FALSE",
        daysSinceChange: lastIdx - swapIdx,
      };
    }
    if (confirmed === "SHORT_TRUE" && bars[i].close > range.high) {
      swapIdx = i;
      return {
        outcome: "SHORT_FALSE",
        daysSinceChange: lastIdx - swapIdx,
      };
    }
  }

  return { outcome: confirmed ?? "NONE", daysSinceChange: null };
}

type ScenarioLine = { name: string; value: number; style?: string; color?: string };

function groupScenarioLines(lines: LevelLineLike[]) {
  const grouped: Record<ScenarioKey, ScenarioLine[]> = {
    LONG_TRUE: [],
    LONG_FALSE: [],
    SHORT_TRUE: [],
    SHORT_FALSE: [],
  };

  for (const line of lines) {
    const value = Number(line.value);
    const name = line.name || "";
    if (!name || !Number.isFinite(value)) continue;

    const upper = name.toUpperCase();
    const normalized = { name, value, style: line.style, color: line.color };
    if (upper.startsWith("LONG_TRUE")) grouped.LONG_TRUE.push(normalized);
    else if (upper.startsWith("LONG_FALSE")) grouped.LONG_FALSE.push(normalized);
    else if (upper.startsWith("SHORT_TRUE")) grouped.SHORT_TRUE.push(normalized);
    else if (upper.startsWith("SHORT_FALSE")) grouped.SHORT_FALSE.push(normalized);
    else if (upper.startsWith("LONG_")) grouped.LONG_TRUE.push(normalized);
    else if (upper.startsWith("SHORT_")) grouped.SHORT_TRUE.push(normalized);
  }

  (Object.keys(grouped) as ScenarioKey[]).forEach((key) => {
    grouped[key].sort((a, b) => {
      const ai = Number(/_(\d+)$/.exec(a.name)?.[1] || 0);
      const bi = Number(/_(\d+)$/.exec(b.name)?.[1] || 0);
      return ai - bi;
    });
  });

  return grouped;
}

function levelIndexMap(lines: ScenarioLine[]) {
  const map: Record<number, number> = {};
  for (const line of lines) {
    const idx = Number(/_(\d+)$/.exec(line.name)?.[1] || NaN);
    if (Number.isFinite(idx) && Number.isFinite(line.value)) {
      map[idx] = line.value;
    }
  }
  return map;
}

type Thresholds = { near: number; mid: number; far: number };

function extractScenarioThresholds(
  grouped: Record<ScenarioKey, ScenarioLine[]>,
  outcome: OutcomeKey,
  direction: "above" | "below",
): Thresholds | null {
  const scenarioKey: ScenarioKey = outcome === "NONE" ? "LONG_TRUE" : outcome;
  const idxMap = levelIndexMap(grouped[scenarioKey] || []);
  const raw = direction === "above"
    ? [idxMap[7], idxMap[8], idxMap[9]]
    : [idxMap[3], idxMap[2], idxMap[1]];

  if (raw.some((value) => !Number.isFinite(value))) return null;
  return { near: raw[0], mid: raw[1], far: raw[2] };
}

function extractSimpleThresholds(
  lines: LevelLineLike[],
  outcome: OutcomeKey,
  direction: "above" | "below",
): Thresholds | null {
  const prefix = outcome.startsWith("SHORT") ? "Short" : "Long";
  const side = direction === "above" ? "High" : "Low";
  const findValue = (pct: number) =>
    lines.find((line) => line.name === `${prefix}_${side}_${pct}`)?.value;

  const near = Number(findValue(80));
  const mid = Number(findValue(50));
  const far = Number(findValue(20));
  if (![near, mid, far].every(Number.isFinite)) return null;
  return { near, mid, far };
}

function classifyZone(
  vsMidPct: number,
  lines: LevelLineLike[],
  model: ModelType,
  outcome: OutcomeKey,
  grouped: Record<ScenarioKey, ScenarioLine[]> | null = null,
): { zone: string; direction: "above" | "below" } {
  const direction = vsMidPct >= 0 ? "above" : "below";
  const dir = direction === "above" ? "UP" : "DN";

  const thresholds = model === "simple"
    ? extractSimpleThresholds(lines, outcome, direction)
    : grouped
      ? extractScenarioThresholds(grouped, outcome, direction)
      : null;

  if (!thresholds) {
    return { zone: `NOT ENOUGH DATA`, direction };
  }

  if (direction === "above") {
    const [near, mid, far] = [thresholds.near, thresholds.mid, thresholds.far].sort((a, b) => a - b);
    if (vsMidPct < near) return { zone: `MID-80% ${dir}`, direction };
    if (vsMidPct < mid) return { zone: `80-50% ${dir}`, direction };
    if (vsMidPct < far) return { zone: `50-20% ${dir}`, direction };
    return { zone: `BEYOND 20% ${dir}`, direction };
  }

  const [near, mid, far] = [thresholds.near, thresholds.mid, thresholds.far].sort((a, b) => b - a);
  if (vsMidPct > near) return { zone: `MID-80% ${dir}`, direction };
  if (vsMidPct > mid) return { zone: `80-50% ${dir}`, direction };
  if (vsMidPct > far) return { zone: `50-20% ${dir}`, direction };
  return { zone: `BEYOND 20% ${dir}`, direction };
}

/* ── Build full symbol list with asset classes ─────────── */

const DEMO_SYMBOL_CLASSES: Record<string, AssetClass> = {
  SPX: "index",
  NQ: "futures",
  BTCUSD: "crypto",
  CL: "futures",
  GC: "futures",
};

async function loadSymbolsWithClasses(source: string): Promise<SymbolWithClass[]> {
  if (source === "demo") {
    return DEMO_SYMBOLS.map((s) => ({
      symbol: s,
      assetClass: DEMO_SYMBOL_CLASSES[s] || "equity",
    }));
  }

  // Load from combined_daily_assets.json and include file paths
  try {
    const assets = await loadCombinedAssets();
    if (assets.length > 0) {
      // Deduplicate by asset_name
      const seen = new Set<string>();
      const result: SymbolWithClass[] = [];
      for (const entry of assets) {
        const sym = entry.asset_name.toUpperCase();
        if (seen.has(sym)) continue;
        seen.add(sym);
        // Resolve file path relative to backend/
        const resolvedPath = entry.file_path
          ? path.isAbsolute(entry.file_path)
            ? entry.file_path
            : path.resolve(ASSETS_BASE_DIR, entry.file_path)
          : undefined;
        result.push({
          symbol: entry.asset_name,
          assetClass: classifyAsset(entry),
          filePath: resolvedPath,
        });
      }
      return result;
    }
  } catch (err) {
    console.warn("[movers] Failed to load combined_daily_assets.json:", err);
  }

  // Fallback: demo symbols
  return DEMO_SYMBOLS.map((s) => ({
    symbol: s,
    assetClass: DEMO_SYMBOL_CLASSES[s] || "equity",
  }));
}

/* ── Pre-filter: verify CSV files exist ────────────────── */

/**
 * Filter symbols to only those with accessible CSV files.
 * This avoids wasting time trying to read non-existent files.
 * Uses parallel fs.access checks (very fast).
 */
async function filterAccessibleSymbols(symbols: SymbolWithClass[]): Promise<SymbolWithClass[]> {
  // Cache the file-access check result — the set of available files only changes nightly
  if (accessibleSymbolsCache && Date.now() - accessibleSymbolsCache.timestamp < ACCESSIBLE_SYMBOLS_TTL_MS) {
    return accessibleSymbolsCache.symbols;
  }

  const checks = await Promise.allSettled(
    symbols.map(async (sym) => {
      if (!sym.filePath) return null;
      await fs.access(sym.filePath);
      return sym;
    }),
  );

  const accessible: SymbolWithClass[] = [];
  for (const result of checks) {
    if (result.status === "fulfilled" && result.value) {
      accessible.push(result.value);
    }
  }

  accessibleSymbolsCache = { symbols: accessible, timestamp: Date.now() };
  return accessible;
}

/* ── Process a single symbol ───────────────────────────── */

async function processSymbol(
  sym: SymbolWithClass,
  source: string,
  levelsMap: Record<string, LevelsEntry>,
  model: ModelType = "pro",
  spxLevelsLines?: LevelLineLike[],
  spxBars?: OhlcvBar[],
): Promise<MoverRow | null> {
  try {
    const bars = await loadOhlcvFast(sym.symbol, source, sym.filePath);
    if (bars.length < 10) return null;

    // Get the last two bars for daily change
    const lastBar = bars[bars.length - 1];
    const prevBar = bars[bars.length - 2];
    const price = lastBar.close;
    const prevClose = prevBar.close;

    if (!Number.isFinite(price) || !Number.isFinite(prevClose) || prevClose === 0) return null;

    const changePct = ((price - prevClose) / prevClose) * 100;

    // Compute quarterly midpoint
    const qr = findCurrentQuarterMid(bars);
    if (!qr || !Number.isFinite(qr.mid) || qr.mid === 0) return null;

    const mid = qr.mid;
    const vsMid = ((price - mid) / mid) * 100;
    const magnitude = Math.abs(vsMid);

    // Load levels for zone classification from pre-loaded map
    let lines: LevelLineLike[] = [];

    if (model === "beta" && spxLevelsLines && spxBars) {
      // Beta model: scale SPX levels by this symbol's vol ratio
      if (sym.symbol === BENCHMARK_SYMBOL) {
        lines = spxLevelsLines;
      } else {
        const volRatio = computeVolRatioFromBars(bars, spxBars);
        lines = scaleLevelsForBeta(spxLevelsLines, volRatio);
      }
    } else {
      // Pro or Simple model: look up from the model-appropriate levels map
      const levelsLookups = [sym.symbol, OHLCV_ALIASES[sym.symbol], sym.symbol.replace(/1!$/, "")].filter(Boolean);
      for (const lookupSym of levelsLookups) {
        const entry = levelsMap[lookupSym!];
        if (entry?.daily?.lines) {
          lines = entry.daily.lines;
          break;
        }
      }
    }

    const groupedScenarioLines = model === "simple" ? null : groupScenarioLines(lines);
    const outcomeDetail = outcomeForRangeDetailed(qr, bars);
    const currentOutcome = outcomeDetail.outcome;
    const { zone, direction } = classifyZone(vsMid, lines, model, currentOutcome, groupedScenarioLines);

    // Compute zones for the quarter's actual traded high and low
    const actualHighVsMid = ((qr.quarterHigh - mid) / mid) * 100;
    const actualLowVsMid = ((qr.quarterLow - mid) / mid) * 100;
    const highZone = classifyZone(actualHighVsMid, lines, model, currentOutcome, groupedScenarioLines);
    const lowZone = classifyZone(actualLowVsMid, lines, model, currentOutcome, groupedScenarioLines);

    // Compute last quarter's close zone relative to the PREVIOUS quarter's distribution.
    let lastQCloseZone: string | undefined;
    if (
      qr.prevQLastClose != null &&
      qr.prevQMid != null &&
      qr.prevQMid !== 0 &&
      qr.prevQStartTime != null &&
      qr.prevQEndTime != null &&
      qr.prevQHigh != null &&
      qr.prevQLow != null
    ) {
      const prevCloseVsMid = ((qr.prevQLastClose - qr.prevQMid) / qr.prevQMid) * 100;
      const prevOutcome = outcomeForRange(
        {
          startTime: qr.prevQStartTime,
          endTime: qr.prevQEndTime,
          high: qr.prevQHigh,
          low: qr.prevQLow,
        },
        bars,
      );
      const prevCloseResult = classifyZone(prevCloseVsMid, lines, model, prevOutcome, groupedScenarioLines);
      lastQCloseZone = prevCloseResult.zone;
    }

    return {
      symbol: sym.symbol,
      price,
      prevClose,
      changePct: Number(changePct.toFixed(2)),
      mid: Number(mid.toFixed(2)),
      quarterHigh: Number(qr.quarterHigh.toFixed(2)),
      quarterLow: Number(qr.quarterLow.toFixed(2)),
      highZone: highZone.zone,
      lowZone: lowZone.zone,
      lastQCloseZone,
      vsMid: Number(vsMid.toFixed(2)),
      zone,
      magnitude: Number(magnitude.toFixed(2)),
      direction,
      assetClass: sym.assetClass,
      scenario: currentOutcome,
      daysSinceChange: outcomeDetail.daysSinceChange,
    };
  } catch {
    // Silent failure for individual symbols — expected for some files
    return null;
  }
}

/* ── Batch processing ──────────────────────────────────── */

async function processInBatches(
  symbols: SymbolWithClass[],
  source: string,
  levelsMap: Record<string, LevelsEntry>,
  model: ModelType = "pro",
  spxLevelsLines?: LevelLineLike[],
  spxBars?: OhlcvBar[],
): Promise<MoverRow[]> {
  const allMovers: MoverRow[] = [];
  let failedCount = 0;

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((sym) => processSymbol(sym, source, levelsMap, model, spxLevelsLines, spxBars)),
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value !== null) {
        allMovers.push(result.value);
      } else {
        failedCount++;
      }
    }
  }

  console.log(`[movers] Processed ${symbols.length} symbols (model=${model}): ${allMovers.length} succeeded, ${failedCount} failed/skipped`);
  return allMovers;
}

/* ── Full recomputation pipeline ───────────────────────── */

async function recomputeMovers(source: string, model: ModelType = "pro"): Promise<MoverRow[]> {
  const t0 = performance.now();

  // Load symbols and levels data in parallel
  // For beta model, load pro levels (will use SPX's for scaling)
  const levelsModel = model === "beta" ? "pro" : model;
  const [allSymbols, levelsMap] = await Promise.all([
    loadSymbolsWithClasses(source),
    loadLevelsData(source, levelsModel).catch((err) => {
      console.log("[movers] Failed to load levels, using empty map:", err instanceof Error ? err.message : String(err));
      return {} as Record<string, LevelsEntry>;
    }),
  ]);

  const t1 = performance.now();

  // Pre-filter: only keep symbols with accessible CSV files.
  // Skip filter if no symbols have file paths — they'll use Wasabi OHLCV fallback instead.
  const allHaveNoPath = allSymbols.length > 0 && allSymbols.every((s) => !s.filePath);
  const symbols = (source === "demo" || allHaveNoPath)
    ? allSymbols
    : await filterAccessibleSymbols(allSymbols);

  const t2 = performance.now();

  console.log(
    `[movers] ${allSymbols.length} total symbols, ${symbols.length} with accessible files ` +
    `(model=${model}, config: ${(t1 - t0).toFixed(0)}ms, access-check: ${(t2 - t1).toFixed(0)}ms)`,
  );

  // For beta model: extract SPX levels and load SPX OHLCV for vol ratio computation
  let spxLevelsLines: LevelLineLike[] | undefined;
  let spxBars: OhlcvBar[] | undefined;

  if (model === "beta") {
    // Get SPX pro levels
    const spxEntry = levelsMap[BENCHMARK_SYMBOL];
    if (spxEntry?.daily?.lines) {
      spxLevelsLines = spxEntry.daily.lines;
    }

    // Load SPX bars for vol ratio computation
    const spxSym = symbols.find((s) => s.symbol === BENCHMARK_SYMBOL);
    if (spxSym) {
      try {
        spxBars = await loadOhlcvFast(BENCHMARK_SYMBOL, source, spxSym.filePath);
      } catch {
        console.warn("[movers] Failed to load SPX bars for beta model");
      }
    }

    if (!spxLevelsLines || !spxBars) {
      console.warn("[movers] Beta model missing SPX data, falling back to pro");
    }
  }

  // Process all accessible symbols in parallel batches
  const allMovers = await processInBatches(symbols, source, levelsMap, model, spxLevelsLines, spxBars);

  const t3 = performance.now();
  console.log(`[movers] Full computation (model=${model}): ${(t3 - t0).toFixed(0)}ms total`);

  return allMovers;
}

/* ── Apply filters and sorting ─────────────────────────── */

function applyFilters(
  movers: MoverRow[],
  classFilter: AssetClass | "all",
  directionFilter: string,
): MoverRow[] {
  let filtered = movers;

  // Apply class filter
  if (classFilter !== "all") {
    filtered = filtered.filter((m) => m.assetClass === classFilter);
  }

  // Apply direction filter
  if (directionFilter === "above") {
    filtered = filtered.filter((m) => m.direction === "above");
  } else if (directionFilter === "below") {
    filtered = filtered.filter((m) => m.direction === "below");
  } else if (directionFilter === "extremes") {
    filtered = filtered.filter(
      (m) => m.zone.includes("BEYOND") || m.zone.includes("80-90%"),
    );
  }

  // Sort by magnitude (biggest movers first)
  filtered.sort((a, b) => b.magnitude - a.magnitude);

  return filtered;
}

function buildResponse(
  movers: MoverRow[],
  totalCount: number,
  source: string,
  cached: boolean,
  timestamp: number,
  computeMs?: number,
) {
  return Response.json(
    {
      movers,
      count: movers.length,
      totalCount,
      source,
      cached,
      timestamp: new Date(timestamp).toISOString(),
      ...(computeMs !== undefined && { computeMs: Math.round(computeMs) }),
    },
    {
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=120, s-maxage=120",
      },
    },
  );
}

/* ── GET handler ───────────────────────────────────────── */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const source = (searchParams.get("source") || "live").toLowerCase();
  const classFilter = (searchParams.get("class") || "all").toLowerCase() as AssetClass | "all";
  const directionFilter = (searchParams.get("direction") || "all").toLowerCase();
  const model = (searchParams.get("model") || "pro").toLowerCase() as ModelType;
  const validModels: ModelType[] = ["pro", "simple", "beta"];
  const safeModel: ModelType = validModels.includes(model) ? model : "pro";

  // Per-model cache key
  const cacheKey = safeModel;
  const useCache = source !== "demo" && process.env.NODE_ENV === "production";

  try {
    const now = Date.now();
    const recomputeInProgress = recomputeInProgressByModel[cacheKey] ?? false;

    // ── 1. In-memory cache (same instance, fastest path) ──
    const memCached = moversCacheByModel[cacheKey] ?? null;
    if (useCache && memCached && now - memCached.timestamp < CACHE_TTL_MS) {
      const movers = applyFilters([...memCached.movers], classFilter, directionFilter);
      return buildResponse(movers, memCached.movers.length, source, true, memCached.timestamp);
    }

    // ── 2. Wasabi shared cache (works across all serverless instances) ──
    if (useCache) {
      try {
        const wasabiCached = await readWasabiJson<CachedResult>(`cache/movers_${cacheKey}.json`);
        if (wasabiCached?.movers && wasabiCached.timestamp) {
          // Populate in-memory cache for this instance
          moversCacheByModel[cacheKey] = wasabiCached;

          if (now - wasabiCached.timestamp < CACHE_TTL_MS) {
            // Fresh — serve immediately
            const movers = applyFilters([...wasabiCached.movers], classFilter, directionFilter);
            return buildResponse(movers, wasabiCached.movers.length, source, true, wasabiCached.timestamp);
          }

          if (now - wasabiCached.timestamp < STALE_SERVE_MS && !recomputeInProgress) {
            // Stale but usable — background recompute + write back to Wasabi
            recomputeInProgressByModel[cacheKey] = true;
            recomputeMovers(source, safeModel)
              .then((allMovers) => {
                const newCache: CachedResult = { movers: allMovers, timestamp: Date.now() };
                moversCacheByModel[cacheKey] = newCache;
                return writeWasabiJson(`cache/movers_${cacheKey}.json`, newCache);
              })
              .then(() => console.log(`[movers] Background recompute + Wasabi write done (model=${safeModel})`))
              .catch((err) => console.error(`[movers] Background recompute failed (model=${safeModel}):`, err))
              .finally(() => { recomputeInProgressByModel[cacheKey] = false; });

            const movers = applyFilters([...wasabiCached.movers], classFilter, directionFilter);
            return buildResponse(movers, wasabiCached.movers.length, source, true, wasabiCached.timestamp);
          }
        }
      } catch {
        // No Wasabi cache yet — fall through to compute
      }
    }

    // ── 3. No cache anywhere — compute synchronously, then write to Wasabi ──
    const t0 = performance.now();
    const computeTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("movers_timeout")), 55_000),
    );
    const allMovers = await Promise.race([recomputeMovers(source, safeModel), computeTimeout]);
    const computeMs = performance.now() - t0;

    if (useCache) {
      const newCache: CachedResult = { movers: allMovers, timestamp: now };
      moversCacheByModel[cacheKey] = newCache;
      // Write to Wasabi non-blocking so the response isn't delayed
      writeWasabiJson(`cache/movers_${cacheKey}.json`, newCache)
        .then(() => console.log(`[movers] Wasabi cache written (model=${safeModel})`))
        .catch((err) => console.error(`[movers] Failed to write Wasabi cache (model=${safeModel}):`, err));
    }

    const movers = applyFilters([...allMovers], classFilter, directionFilter);
    return buildResponse(movers, allMovers.length, source, false, now, computeMs);
  } catch (err: any) {
    if (err?.message === "movers_timeout") {
      console.error(`[movers] Computation timed out after 55s (model=${safeModel})`);
      return Response.json({ error: "Computation timed out — cache warming in progress, try again shortly.", movers: [] }, { status: 503 });
    }
    console.error("[movers] Fatal error:", err);
    return Response.json({ error: "Failed to compute movers", movers: [] }, { status: 500 });
  }
}
