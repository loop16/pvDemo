import { NextRequest } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { Readable } from "stream";

export const runtime = "nodejs";

type SymbolEntry = { id: string; label: string };

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

  if (shouldUseWasabi(source)) {
    try {
      const data = await readWasabiJson<SymbolEntry[]>("symbols/index.json");
      return Response.json(data, { headers: { "cache-control": "public, max-age=300, s-maxage=300" } });
    } catch (error) {
      console.warn("Wasabi symbols index missing, falling back to local.", error);
    }
  }

  try {
    const data = await readJsonFile<SymbolEntry[]>(LEVELS_INDEX_LOCAL);
    return Response.json(data, { headers: { "cache-control": "public, max-age=300, s-maxage=300" } });
  } catch {
    const fallback = await loadFallbackSymbols();
    return Response.json(fallback, { headers: { "cache-control": "public, max-age=300, s-maxage=300" } });
  }
}
