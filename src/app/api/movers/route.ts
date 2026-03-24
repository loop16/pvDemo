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
};

type CachedResult = {
  movers: MoverRow[];
  timestamp: number;
};

/* ── Config ────────────────────────────────────────────── */

const DEMO_SYMBOLS = ["SPX", "NQ", "BTCUSD", "CL", "GC"];
const BATCH_SIZE = 200; // Higher parallelism for I/O-bound reads
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes — data updates nightly
const STALE_SERVE_MS = 60 * 60 * 1000; // Serve stale cache up to 1 hour while recomputing
const TAIL_BYTES = 12_288; // Read last 12 KB of each CSV (~150 rows, covers current quarter)

const LEVELS_LOCAL_DIR = path.join(process.cwd(), "public", "mock", "levels");
const DEMO_OHLCV_DIR = path.join(process.cwd(), "public", "mock", "ohlcv");
const COMBINED_ASSETS_PATH = path.join(process.cwd(), "backend", "combined_daily_assets.json");
const ASSETS_BASE_DIR = path.join(process.cwd(), "backend");

const DEFAULT_LEVELS_SOURCE = (process.env.QPP_LEVELS_SOURCE || "wasabi").toLowerCase();
const DEFAULT_OHLCV_SOURCE = (process.env.QPP_OHLCV_SOURCE || "live").toLowerCase();
const WASABI_PREFIX = (process.env.WASABI_PREFIX || "levels").replace(/^\/+|\/+$/g, "");

const OHLCV_ALIASES: Record<string, string> = {
  BTCUSD: "BTC",
  CL: "CL1!",
  GC: "GC1!",
  NQ: "NQ1!",
};

/* ── In-memory cache ───────────────────────────────────── */

let moversCache: CachedResult | null = null;
let recomputeInProgress = false;

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
    const csv = await readCsvTail(resolvedFilePath);
    const rows = parseCsvOhlcv(csv);
    if (rows.length > 0) {
      // CSV files are already in chronological order, but tail-read data should be sorted
      return sortBars(rows);
    }
  }

  throw new Error(`No OHLCV data available for ${symbol}`);
}

async function loadLevelsData(source: string): Promise<Record<string, LevelsEntry>> {
  if (shouldUseWasabi(source)) {
    return await readWasabiJson<Record<string, LevelsEntry>>("levels.json");
  }
  return await readJsonFile<Record<string, LevelsEntry>>(
    path.join(LEVELS_LOCAL_DIR, "levels.json"),
  );
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

type QuarterRange = {
  qkey: string;
  high: number;
  low: number;
  mid: number;
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
    const firstFriIdx = idxs.find((i) => isFriday(toEpochSeconds(bars[i].time)));
    if (firstFriIdx === undefined) {
      // No Friday found in this quarter - use first two bars as fallback
      if (idxs.length >= 2) {
        const high = Math.max(bars[idxs[0]].high, bars[idxs[1]].high);
        const low = Math.min(bars[idxs[0]].low, bars[idxs[1]].low);
        const mid = (high + low) / 2;
        if (mid !== 0) {
          ranges.push({ qkey: key, high, low, mid });
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
    ranges.push({ qkey: key, high, low, mid });
  }

  // Return the last (current) quarter range
  return ranges.length ? ranges[ranges.length - 1] : null;
}

/* ── Zone classification ───────────────────────────────── */

function classifyZone(
  vsMidPct: number,
  lines: LevelLineLike[],
): { zone: string; direction: "above" | "below" } {
  const direction = vsMidPct >= 0 ? "above" : "below";
  const absPct = Math.abs(vsMidPct);

  // Extract Long_True levels (the main model lines) sorted by value
  const longTrue = lines
    .filter((l) => l.name && /^Long_True_\d+$/i.test(l.name))
    .map((l) => ({ name: l.name!, value: Number(l.value) }))
    .filter((l) => Number.isFinite(l.value))
    .sort((a, b) => a.value - b.value);

  if (!longTrue.length) {
    // No model lines available, use simple thresholds
    if (absPct < 1) return { zone: "NEAR MID", direction };
    if (absPct < 3) return { zone: `0-20% ${direction === "above" ? "UP" : "DN"}`, direction };
    if (absPct < 5) return { zone: `20-50% ${direction === "above" ? "UP" : "DN"}`, direction };
    if (absPct < 8) return { zone: `50-80% ${direction === "above" ? "UP" : "DN"}`, direction };
    return { zone: `BEYOND 80% ${direction === "above" ? "UP" : "DN"}`, direction };
  }

  const median = longTrue.find((l) => /Long_True_5/i.test(l.name));
  const l2 = longTrue.find((l) => /Long_True_2/i.test(l.name));
  const l8 = longTrue.find((l) => /Long_True_8/i.test(l.name));
  const l9 = longTrue.find((l) => /Long_True_9/i.test(l.name));

  const t20 = l2 ? Math.abs(l2.value) : 1;
  const t50 = median ? Math.abs(median.value) : 3;
  const t80 = l8 ? Math.abs(l8.value) : 7;
  const t90 = l9 ? Math.abs(l9.value) : 10;

  const dir = direction === "above" ? "UP" : "DN";

  if (absPct < t20) return { zone: "NEAR MID", direction };
  if (absPct < t50) return { zone: `20-50% ${dir}`, direction };
  if (absPct < t80) return { zone: `50-80% ${dir}`, direction };
  if (absPct < t90) return { zone: `80-90% ${dir}`, direction };
  return { zone: `BEYOND 90% ${dir}`, direction };
}

/* ── Build full symbol list with asset classes ─────────── */

type SymbolWithClass = {
  symbol: string;
  assetClass: AssetClass;
  filePath?: string; // resolved file path for live mode
};

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
  return accessible;
}

/* ── Process a single symbol ───────────────────────────── */

async function processSymbol(
  sym: SymbolWithClass,
  source: string,
  levelsMap: Record<string, LevelsEntry>,
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
    // Try multiple symbol name variants for lookup
    let lines: LevelLineLike[] = [];
    const levelsLookups = [sym.symbol, OHLCV_ALIASES[sym.symbol], sym.symbol.replace(/1!$/, "")].filter(Boolean);
    for (const lookupSym of levelsLookups) {
      const entry = levelsMap[lookupSym!];
      if (entry?.daily?.lines) {
        lines = entry.daily.lines;
        break;
      }
    }

    const { zone, direction } = classifyZone(vsMid, lines);

    return {
      symbol: sym.symbol,
      price,
      prevClose,
      changePct: Number(changePct.toFixed(2)),
      mid: Number(mid.toFixed(2)),
      vsMid: Number(vsMid.toFixed(2)),
      zone,
      magnitude: Number(magnitude.toFixed(2)),
      direction,
      assetClass: sym.assetClass,
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
): Promise<MoverRow[]> {
  const allMovers: MoverRow[] = [];
  let failedCount = 0;

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((sym) => processSymbol(sym, source, levelsMap)),
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value !== null) {
        allMovers.push(result.value);
      } else {
        failedCount++;
      }
    }
  }

  console.log(`[movers] Processed ${symbols.length} symbols: ${allMovers.length} succeeded, ${failedCount} failed/skipped`);
  return allMovers;
}

/* ── Full recomputation pipeline ───────────────────────── */

async function recomputeMovers(source: string): Promise<MoverRow[]> {
  const t0 = performance.now();

  // Load symbols and levels data in parallel
  const [allSymbols, levelsMap] = await Promise.all([
    loadSymbolsWithClasses(source),
    loadLevelsData(source).catch((err) => {
      console.log("[movers] Failed to load levels, using empty map:", err instanceof Error ? err.message : String(err));
      return {} as Record<string, LevelsEntry>;
    }),
  ]);

  const t1 = performance.now();

  // Pre-filter: only keep symbols with accessible CSV files
  const symbols = source === "demo"
    ? allSymbols
    : await filterAccessibleSymbols(allSymbols);

  const t2 = performance.now();

  console.log(
    `[movers] ${allSymbols.length} total symbols, ${symbols.length} with accessible files ` +
    `(config: ${(t1 - t0).toFixed(0)}ms, access-check: ${(t2 - t1).toFixed(0)}ms)`,
  );

  // Process all accessible symbols in parallel batches
  const allMovers = await processInBatches(symbols, source, levelsMap);

  const t3 = performance.now();
  console.log(`[movers] Full computation: ${(t3 - t0).toFixed(0)}ms total`);

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

  try {
    const now = Date.now();

    // ── Serve from cache if fresh ──
    if (
      source !== "demo" &&
      moversCache &&
      now - moversCache.timestamp < CACHE_TTL_MS
    ) {
      const movers = applyFilters([...moversCache.movers], classFilter, directionFilter);
      return buildResponse(movers, moversCache.movers.length, source, true, moversCache.timestamp);
    }

    // ── Serve stale cache while recomputing in background ──
    if (
      source !== "demo" &&
      moversCache &&
      now - moversCache.timestamp < STALE_SERVE_MS &&
      !recomputeInProgress
    ) {
      // Trigger background recomputation (fire-and-forget)
      recomputeInProgress = true;
      recomputeMovers(source)
        .then((allMovers) => {
          moversCache = { movers: allMovers, timestamp: Date.now() };
          console.log(`[movers] Background recompute complete: ${allMovers.length} symbols`);
        })
        .catch((err) => {
          console.error("[movers] Background recompute failed:", err);
        })
        .finally(() => {
          recomputeInProgress = false;
        });

      // Serve stale data immediately
      const movers = applyFilters([...moversCache.movers], classFilter, directionFilter);
      return buildResponse(movers, moversCache.movers.length, source, true, moversCache.timestamp);
    }

    // ── First request or cache expired: compute synchronously ──
    const t0 = performance.now();
    const allMovers = await recomputeMovers(source);
    const computeMs = performance.now() - t0;

    // Cache the full results (before filtering)
    if (source !== "demo") {
      moversCache = { movers: allMovers, timestamp: now };
    }

    const movers = applyFilters([...allMovers], classFilter, directionFilter);
    return buildResponse(movers, allMovers.length, source, false, now, computeMs);
  } catch (err) {
    console.error("[movers] Fatal error:", err);
    return Response.json({ error: "Failed to compute movers", movers: [] }, { status: 500 });
  }
}
