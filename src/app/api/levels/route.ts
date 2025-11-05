import { NextRequest } from "next/server";
import path from "path";
import { promises as fs } from "fs";

export const runtime = "nodejs";

type OhlcvBar = { time: string | number; close: number };
type RawOhlcvRow = { time?: string | number; close?: number | string | null };
type LevelLineLike = { name?: string; value?: number | string; style?: string; color?: string };
type LevelsEntry = {
  symbol?: string;
  asof?: string;
  daily?: { lines?: LevelLineLike[] };
  meta?: Record<string, unknown>;
};

const BENCHMARK_SYMBOL = "SPX";
const BETA_LOOKBACK_DAYS = 252;
const BETA_CLAMP = 5;

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
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

async function loadOhlcv(symbol: string): Promise<OhlcvBar[]> {
  const file = path.join(process.cwd(), "public", "mock", "ohlcv", `${symbol}.json`);
  const rows = await readJsonFile<RawOhlcvRow[]>(file);
  if (!Array.isArray(rows)) throw new Error(`Unexpected OHLCV shape for ${symbol}`);

  return rows
    .map(row => {
      const close = Number(row?.close);
      const time = row?.time;
      if (!Number.isFinite(close) || time == null) return null;
      return { time, close } as OhlcvBar;
    })
    .filter((row): row is OhlcvBar => Boolean(row))
    .sort((a, b) => {
      const ta = normalizeDate(a.time);
      const tb = normalizeDate(b.time);
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    });
}

type Paired = { ts: number | Date; asset: number; bench: number };

/**
 * Build aligned return series from two bar sets
 * Returns paired returns where both assets have data on the same date
 */
function buildAlignedReturnSeries(assetBars: OhlcvBar[], benchmarkBars: OhlcvBar[]): Paired[] {
  // Build date-indexed maps for both series
  const assetByDate = new Map<string, { ret: number; ts: number | Date }>();
  const benchByDate = new Map<string, { ret: number; ts: number | Date }>();

  // Helper to convert time to Date or number
  const toTimestamp = (time: string | number): number | Date => {
    if (typeof time === 'number') {
      return time > 1e12 ? time : time * 1000;
    }
    const parsed = new Date(time);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  // Build asset returns
  for (let i = 1; i < assetBars.length; i++) {
    const prev = assetBars[i - 1];
    const curr = assetBars[i];
    if (!Number.isFinite(prev.close) || !Number.isFinite(curr.close) || prev.close <= 0 || curr.close <= 0) continue;
    const ret = Math.log(curr.close / prev.close);
    if (!Number.isFinite(ret)) continue;
    const date = normalizeDate(curr.time);
    const ts = toTimestamp(curr.time);
    assetByDate.set(date, { ret, ts });
  }

  // Build benchmark returns
  for (let i = 1; i < benchmarkBars.length; i++) {
    const prev = benchmarkBars[i - 1];
    const curr = benchmarkBars[i];
    if (!Number.isFinite(prev.close) || !Number.isFinite(curr.close) || prev.close <= 0 || curr.close <= 0) continue;
    const ret = Math.log(curr.close / prev.close);
    if (!Number.isFinite(ret)) continue;
    const date = normalizeDate(curr.time);
    const ts = toTimestamp(curr.time);
    benchByDate.set(date, { ret, ts });
  }

  // Find common dates and pair returns
  const paired: Paired[] = [];
  const allDates = new Set([...assetByDate.keys(), ...benchByDate.keys()]);
  
  for (const date of allDates) {
    const assetData = assetByDate.get(date);
    const benchData = benchByDate.get(date);
    if (assetData && benchData && Number.isFinite(assetData.ret) && Number.isFinite(benchData.ret)) {
      // Use the asset's timestamp (they should be the same date anyway)
      paired.push({ ts: assetData.ts, asset: assetData.ret, bench: benchData.ret });
    }
  }

  // Sort by timestamp (ascending)
  paired.sort((a, b) => {
    const ta = a.ts instanceof Date ? a.ts.getTime() : (typeof a.ts === 'number' ? a.ts : 0);
    const tb = b.ts instanceof Date ? b.ts.getTime() : (typeof b.ts === 'number' ? b.ts : 0);
    return ta - tb;
  });
  
  return paired;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Compute beta using aligned return series
 * Beta = Cov(r_asset, r_bench) / Var(r_bench)
 * Measures sensitivity to market directional moves (conditional projection)
 */
function computeBeta(assetBars: OhlcvBar[], benchmarkBars: OhlcvBar[], lookback = BETA_LOOKBACK_DAYS) {
  const paired = buildAlignedReturnSeries(assetBars, benchmarkBars);

  if (paired.length < 2) {
    return { beta: 1, sampleSize: paired.length, pairedCount: paired.length };
  }

  // Take the most recent lookback window
  const start = Math.max(0, paired.length - lookback);
  const sample = paired.slice(start);
  const n = sample.length;
  
  if (n < 2) {
    return { beta: 1, sampleSize: n, pairedCount: paired.length };
  }

  // Compute means
  let sumAsset = 0;
  let sumBench = 0;
  for (const p of sample) {
    sumAsset += p.asset;
    sumBench += p.bench;
  }
  const meanAsset = sumAsset / n;
  const meanBench = sumBench / n;

  // Compute covariance and variance
  let cov = 0;
  let varBench = 0;
  for (const p of sample) {
    const da = p.asset - meanAsset;
    const db = p.bench - meanBench;
    cov += da * db;
    varBench += db * db;
  }

  // Use sample variance (divide by n-1)
  cov /= (n - 1);
  varBench /= (n - 1);

  if (!Number.isFinite(cov) || !Number.isFinite(varBench) || Math.abs(varBench) < 1e-12) {
    return { beta: 1, sampleSize: n, pairedCount: paired.length };
  }

  const beta = cov / varBench;
  
  return { 
    beta: Number.isFinite(beta) ? beta : 1, 
    sampleSize: n,
    pairedCount: paired.length,
    meanAsset,
    meanBench,
    cov,
    varBench
  };
}

/**
 * Compute volatility ratio: σ_asset / σ_SPX
 * Use this for scaling unconditional percentile bands (not beta!)
 * Beta = correlation × volatility ratio, so beta collapses for uncorrelated assets
 */
function computeVolRatio(assetBars: OhlcvBar[], benchmarkBars: OhlcvBar[], lookback = 1250) {
  const paired = buildAlignedReturnSeries(assetBars, benchmarkBars);

  if (paired.length < 5) {
    return { ratio: 1, sampleSize: paired.length };
  }

  // Take the most recent lookback window
  const start = Math.max(0, paired.length - lookback);
  const sample = paired.slice(start);
  const n = sample.length;

  if (n < 2) {
    return { ratio: 1, sampleSize: n };
  }

  // Extract return arrays
  const rA = sample.map(p => p.asset);
  const rM = sample.map(p => p.bench);

  // Compute means
  const mean = (x: number[]) => {
    const sum = x.reduce((a, b) => a + b, 0);
    return sum / x.length;
  };
  const mA = mean(rA);
  const mM = mean(rM);

  // Compute standard deviations (sample std: divide by n-1)
  const sd = (x: number[], m: number) => {
    if (x.length < 2) return 0;
    const variance = x.reduce((s, xi) => s + (xi - m) * (xi - m), 0) / (x.length - 1);
    return Math.sqrt(variance);
  };

  const sdA = sd(rA, mA);
  const sdM = sd(rM, mM);

  // Volatility ratio
  const ratio = (Number.isFinite(sdA) && Number.isFinite(sdM) && sdM > 1e-12) 
    ? (sdA / sdM) 
    : 1;

  return { 
    ratio: Number.isFinite(ratio) ? ratio : 1, 
    sampleSize: n,
    sdAsset: sdA,
    sdBenchmark: sdM
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawSymbol = (searchParams.get("symbol") || "SPY").toUpperCase();
  const model = (searchParams.get("model") || "pro").toLowerCase();
  
  // Map symbols to the consolidated levels file
  const symbolMap: Record<string, string> = {
    NQ: "NDX",
    BTCUSD: "BTC",
    CL: "CL",
    GC: "GC",
    SPX: "SPX",
  };

  if (model === "beta") {
    try {
      const [assetBars, benchmarkBars, levelsData] = await Promise.all([
        loadOhlcv(rawSymbol),
        loadOhlcv(BENCHMARK_SYMBOL),
        readJsonFile<Record<string, LevelsEntry>>(path.join(process.cwd(), "public", "mock", "levels", "levels.json")),
      ]);

      const spxLevels = levelsData[BENCHMARK_SYMBOL];
      if (!spxLevels) {
        console.error("Missing SPX levels in levels.json");
        return Response.json({ error: "benchmark levels unavailable" }, { status: 500 });
      }

      // For scaling unconditional percentile bands, use volatility ratio (not beta!)
      // Beta measures directional sensitivity; vol ratio measures relative volatility width
      const volResult = rawSymbol === BENCHMARK_SYMBOL
        ? { ratio: 1, sampleSize: benchmarkBars.length, sdAsset: 0, sdBenchmark: 0 }
        : computeVolRatio(assetBars, benchmarkBars, 1250);

      const computedVolRatio = volResult.ratio;
      // Clamp vol ratio to reasonable bounds (e.g., 0.2x to 5x)
      const safeVolRatio = clamp(Number.isFinite(computedVolRatio) ? computedVolRatio : 1, 1 / BETA_CLAMP, BETA_CLAMP);
      
      // Also compute beta for reference (even though we use vol ratio for scaling)
      const betaResult = rawSymbol === BENCHMARK_SYMBOL
        ? { beta: 1, sampleSize: benchmarkBars.length, pairedCount: benchmarkBars.length }
        : computeBeta(assetBars, benchmarkBars);
      const computedBeta = betaResult.beta;
      
      // Log calculations for debugging
      console.log(`[Beta Model] ${rawSymbol} vs ${BENCHMARK_SYMBOL}:`, {
        volRatio: computedVolRatio,
        clampedVolRatio: safeVolRatio,
        beta: computedBeta,
        volRatioSampleSize: volResult.sampleSize,
        betaSampleSize: betaResult.sampleSize,
        sdAsset: 'sdAsset' in volResult ? volResult.sdAsset : 'N/A',
        sdBenchmark: 'sdBenchmark' in volResult ? volResult.sdBenchmark : 'N/A',
        assetBars: assetBars.length,
        benchmarkBars: benchmarkBars.length,
      });

      // Scale SPX percentage levels by volatility ratio (not beta!)
      // If SPX level is +5% and vol ratio is 1.5, asset level becomes +7.5%
      // This preserves the unconditional width of bands, unlike beta which collapses for uncorrelated assets
      const scaledLines = (spxLevels?.daily?.lines ?? []).map((line: LevelLineLike): LevelLineLike => {
        const pct = Number(line?.value);
        if (!Number.isFinite(pct)) {
          return { ...line }; // Keep original value if not a valid number
        }
        // Scale the percentage deviation by volatility ratio
        const scaled = Number((pct * safeVolRatio).toFixed(6));
        return { ...line, value: scaled };
      });

      const meta = {
        ...(spxLevels.meta || {}),
        beta: {
          // Store both vol ratio (used for scaling) and beta (for reference)
          volRatio: Number(safeVolRatio.toFixed(4)),
          rawVolRatio: Number.isFinite(computedVolRatio) ? Number(computedVolRatio.toFixed(4)) : 1,
          beta: Number.isFinite(computedBeta) ? Number(computedBeta.toFixed(4)) : 1,
          lookbackDays: Math.min(1250, volResult.sampleSize),
          benchmark: BENCHMARK_SYMBOL,
          sampleSize: volResult.sampleSize,
        },
      };

      return Response.json(
        {
          symbol: rawSymbol,
          asof: spxLevels.asof,
          daily: { lines: scaledLines },
          meta,
        },
        {
          headers: {
            "content-type": "application/json",
            "cache-control": "public, max-age=600, s-maxage=600",
          },
        },
      );
    } catch (error: unknown) {
      console.error("Beta model failure", error);
      const code = typeof error === "object" && error && "code" in error ? (error as { code?: string }).code : undefined;
      const status = code === "ENOENT" ? 404 : 500;
      return Response.json({ error: "beta model unavailable" }, { status });
    }
  }

  const mappedSymbol = symbolMap[rawSymbol] || rawSymbol;
  
  // Choose the appropriate levels file based on model
  const levelsFile = model === "simple" 
    ? path.join(process.cwd(), "public", "mock", "levels", "basic_levels.json")
    : path.join(process.cwd(), "public", "mock", "levels", "levels.json");

  try {
    const allLevels = await readJsonFile<Record<string, LevelsEntry>>(levelsFile);
    
    if (allLevels[mappedSymbol]) {
      return Response.json(allLevels[mappedSymbol], {
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=3600, s-maxage=3600",
        },
      });
    } else {
      return Response.json({ error: "symbol not found" }, { status: 404 });
    }
  } catch (error) {
    console.error("Error reading levels file:", error);
    return Response.json({ error: "not found" }, { status: 404 });
  }
}

