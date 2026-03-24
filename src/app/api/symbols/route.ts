import { NextRequest } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { Readable } from "stream";

export const runtime = "nodejs";

type AssetClass = 'equity' | 'crypto' | 'futures' | 'fx' | 'index' | 'etf';
type SymbolEntry = { id: string; label: string; class?: AssetClass };
const SYMBOL_ID_RENAMES: Record<string, string> = {
  CL: "CL1!",
  GC: "GC1!",
};

/* ── Asset-class catalogue from combined_daily_assets.json ── */
type RawAsset = {
  asset_name: string;
  file_path: string;
  tv_symbol: string;
  tv_exchange: string | string[];
};

const COMBINED_ASSETS_PATH = path.join(process.cwd(), "backend", "combined_daily_assets.json");

let assetClassMap: Map<string, AssetClass> | null = null;

function classifyAsset(asset: RawAsset): AssetClass {
  const fp = asset.file_path || "";
  const exchanges: string[] = Array.isArray(asset.tv_exchange)
    ? asset.tv_exchange
    : asset.tv_exchange
      ? [asset.tv_exchange]
      : [];

  // Classify by file_path prefix first (most reliable)
  if (/CRYPTO_/i.test(fp)) return "crypto";
  if (/\/(ETF_|THEME_)/i.test(fp)) return "etf";
  if (/\/INDEX_/i.test(fp)) return "index";
  if (/\/FX_/i.test(fp)) return "fx";
  if (/\/(NYMEX_|COMEX_|CME_MINI_|CME_|CBOT_MINI_|CBOT_|ICEUS_|FUTURES_|EUREX_)/i.test(fp)) return "futures";
  if (/\/(SP500_|TOP1000_)/i.test(fp)) return "equity";

  // Fallback: classify by exchange
  const exSet = new Set(exchanges.map((e) => e.toUpperCase()));
  if (exSet.has("BINANCE") || exSet.has("BINANCEUS") || exSet.has("COINBASE")) return "crypto";
  if (exSet.has("FX_IDC") || exSet.has("OANDA")) return "fx";
  if (exSet.has("CME_MINI") || exSet.has("COMEX") || exSet.has("NYMEX") || exSet.has("CBOT") || exSet.has("CME") || exSet.has("ICEUS") || exSet.has("EUREX")) return "futures";
  if (exSet.has("INDEX") || exSet.has("DJI")) return "index";
  // TVC + CBOE can be index (like SPX, NDX, VIX)
  if (exSet.has("TVC") || exSet.has("CBOE")) {
    const indexSymbols = new Set(["SPX", "NDX", "RUT", "VIX", "DXY", "DJI", "HSI", "HSCEI", "UKX", "DAX", "CAC40", "EU50", "IBEX", "SMI", "AEX", "OMXS30", "OMXC25", "XJO", "NI225", "KOSPI", "NIFTY"]);
    if (indexSymbols.has(asset.asset_name.toUpperCase())) return "index";
  }
  if (exSet.has("NYSEARCA") || exSet.has("AMEX") || exSet.has("NYSE") || exSet.has("NASDAQ") || exSet.has("BATS")) return "equity";

  return "equity";
}

async function loadAssetClassMap(): Promise<Map<string, AssetClass>> {
  if (assetClassMap) return assetClassMap;
  try {
    const raw = await fs.readFile(COMBINED_ASSETS_PATH, "utf-8");
    const assets: RawAsset[] = JSON.parse(raw);
    const map = new Map<string, AssetClass>();
    for (const asset of assets) {
      const cls = classifyAsset(asset);
      map.set(asset.asset_name.toUpperCase(), cls);
    }
    assetClassMap = map;
    return map;
  } catch {
    return new Map();
  }
}

const DEFAULT_LEVELS_SOURCE = (process.env.QPP_LEVELS_SOURCE || "wasabi").toLowerCase();
const WASABI_PREFIX = (process.env.WASABI_PREFIX || "levels").replace(/^\/+|\/+$/g, "");
const LEVELS_INDEX_LOCAL = path.join(process.cwd(), "data", "levels", "symbols", "index.json");
const CATALOG_PATH = path.join(process.cwd(), "public", "catalog.json");
const FALLBACK_LEVELS_PATH = path.join(process.cwd(), "public", "mock", "levels", "levels.json");

async function streamToString(stream: unknown): Promise<string> {
  if (!stream) return "";
  if (typeof stream === "string") return stream;
  if (stream instanceof Uint8Array) return Buffer.from(stream).toString("utf-8");
  if (typeof (stream as { transformToString?: () => Promise<string> }).transformToString === "function") {
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
  if (source === "demo" || source === "local") return false;
  if (DEFAULT_LEVELS_SOURCE === "local") return false;
  return Boolean(
    process.env.WASABI_BUCKET &&
    process.env.WASABI_ACCESS_KEY_ID &&
    process.env.WASABI_SECRET_ACCESS_KEY
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

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

async function loadCatalogSymbols(): Promise<SymbolEntry[]> {
  try {
    return await readJsonFile<SymbolEntry[]>(CATALOG_PATH);
  } catch {
    return [];
  }
}

async function loadFallbackSymbols(): Promise<SymbolEntry[]> {
  try {
    const levels = await readJsonFile<Record<string, unknown>>(FALLBACK_LEVELS_PATH);
    return Object.keys(levels).sort().map((id) => ({ id, label: id }));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const source = (searchParams.get("source") || DEFAULT_LEVELS_SOURCE).toLowerCase();

  if (source === "demo") {
    const catalog = await loadCatalogSymbols();
    return Response.json(catalog, { headers: { "cache-control": "public, max-age=300, s-maxage=300" } });
  }

  const classMap = await loadAssetClassMap();

  const rewriteSymbols = (symbols: SymbolEntry[]) => {
    const seen = new Set<string>();
    const mapped = symbols.map((entry) => {
      const mappedId = SYMBOL_ID_RENAMES[entry.id] || entry.id;
      const mappedLabel = entry.label === entry.id ? mappedId : entry.label;
      const cls = entry.class || classMap.get(mappedId.toUpperCase()) || classMap.get(entry.id.toUpperCase()) || "equity";
      return { ...entry, id: mappedId, label: mappedLabel, class: cls };
    });
    return mapped.filter((entry) => {
      const key = entry.id.toUpperCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  if (shouldUseWasabi(source)) {
    try {
      const data = await readWasabiJson<SymbolEntry[]>("symbols/index.json");
      return Response.json(rewriteSymbols(data), { headers: { "cache-control": "public, max-age=300, s-maxage=300" } });
    } catch (error) {
      console.warn("Wasabi symbols index missing, falling back to local.", error);
    }
  }

  try {
    const data = await readJsonFile<SymbolEntry[]>(LEVELS_INDEX_LOCAL);
    return Response.json(rewriteSymbols(data), { headers: { "cache-control": "public, max-age=300, s-maxage=300" } });
  } catch {
    const fallback = await loadFallbackSymbols();
    return Response.json(rewriteSymbols(fallback), { headers: { "cache-control": "public, max-age=300, s-maxage=300" } });
  }
}
