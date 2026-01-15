import { NextRequest } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { Readable } from "stream";

export const runtime = "nodejs"; // allow fs

type OhlcvRow = { time: string; open: number; high: number; low: number; close: number };
type AssetEntry = { asset_name: string; file_path: string };

const DEFAULT_OHLCV_SOURCE = (process.env.QPP_OHLCV_SOURCE || "live").toLowerCase();
const DEMO_DIR = path.join(process.cwd(), "public", "mock", "ohlcv");
const BACKEND_DIR = path.join(process.cwd(), "backend");
const ASSETS_PATH = path.join(BACKEND_DIR, "assets.json");
const WASABI_PREFIX = (process.env.WASABI_PREFIX || "levels").replace(/^\/+|\/+$/g, "");
const WASABI_OHLCV_DIR = "ohlcv/symbols";
const SYMBOL_ALIASES: Record<string, string> = {
  BTCUSD: "BTC",
};

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

function shouldUseWasabi(source: string) {
  if (source === "demo" || source === "local") return false;
  if (DEFAULT_OHLCV_SOURCE === "local") return false;
  return Boolean(
    process.env.WASABI_BUCKET &&
      process.env.WASABI_ACCESS_KEY_ID &&
      process.env.WASABI_SECRET_ACCESS_KEY
  );
}

function buildWasabiKey(pathParts: string) {
  return WASABI_PREFIX ? `${WASABI_PREFIX}/${pathParts}` : pathParts;
}

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

    if (shouldUseWasabi(source)) {
      try {
        const data = await readWasabiJson<OhlcvRow[]>(`${WASABI_OHLCV_DIR}/${symbol}.json`);
        return Response.json(data, {
          headers: {
            "content-type": "application/json",
            "cache-control": "public, max-age=60, s-maxage=60"
          }
        });
      } catch (err: any) {
        const status =
          err?.$metadata?.httpStatusCode === 404 || err?.name === "NoSuchKey" ? 404 : 500;
        if (status !== 404) {
          console.error("Wasabi OHLCV error:", err);
          return Response.json({ error: "Failed to load OHLCV" }, { status });
        }
        // Fall back to local CSV if available.
      }
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
