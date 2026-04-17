import { NextRequest } from "next/server";
import { Readable } from "stream";
import { getUserByApiKey } from "@/lib/user-store";

export const runtime = "nodejs";
export const maxDuration = 30;

const WASABI_PREFIX = (process.env.WASABI_PREFIX || "levels").replace(/^\/+|\/+$/g, "");

let _s3Client: import("@aws-sdk/client-s3").S3Client | null = null;
let _s3Bucket = "";

async function getS3Client() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  const bucket = process.env.WASABI_BUCKET || "";
  const accessKeyId = process.env.WASABI_ACCESS_KEY_ID || "";
  const secretAccessKey = process.env.WASABI_SECRET_ACCESS_KEY || "";
  const endpoint = process.env.WASABI_ENDPOINT || "https://s3.us-east-1.wasabisys.com";
  const region = process.env.WASABI_REGION || "us-east-1";
  if (!_s3Client || _s3Bucket !== bucket) {
    _s3Client = new S3Client({ region, endpoint, credentials: { accessKeyId, secretAccessKey }, maxAttempts: 2 });
    _s3Bucket = bucket;
  }
  return { client: _s3Client, bucket };
}

async function streamToString(stream: unknown): Promise<string> {
  if (stream instanceof Readable) {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      (stream as Readable).on("data", (c: Buffer) => chunks.push(c));
      (stream as Readable).on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      (stream as Readable).on("error", reject);
    });
  }
  if (stream && typeof (stream as any)[Symbol.asyncIterator] === "function") {
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array>) chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf-8");
  }
  throw new Error("Unreadable stream");
}

async function readWasabiJson<T>(key: string): Promise<T> {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { client, bucket } = await getS3Client();
  const fullKey = WASABI_PREFIX ? `${WASABI_PREFIX}/${key}` : key;
  const resp = await client.send(new GetObjectCommand({ Bucket: bucket, Key: fullKey }));
  const raw = await streamToString(resp.Body);
  return JSON.parse(raw) as T;
}

type MoverRow = Record<string, unknown>;
type CachedResult = { movers: MoverRow[]; timestamp: number };

const VALID_MODELS = ["pro", "simple", "beta"] as const;
type ModelType = typeof VALID_MODELS[number];

export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return Response.json({ error: "Missing x-api-key header" }, { status: 401 });
  }

  const user = await getUserByApiKey(apiKey);
  if (!user) {
    return Response.json({ error: "Invalid API key" }, { status: 401 });
  }
  if (!user.stripePaid) {
    return Response.json({ error: "Subscription inactive" }, { status: 403 });
  }

  // ── Params ────────────────────────────────────────────
  const { searchParams } = new URL(req.url);
  const modelParam = (searchParams.get("model") || "pro").toLowerCase();
  const model: ModelType = (VALID_MODELS as readonly string[]).includes(modelParam)
    ? (modelParam as ModelType)
    : "pro";

  const classFilter = searchParams.get("class")?.toLowerCase() || null;
  const directionFilter = searchParams.get("direction")?.toLowerCase() || null;
  const zoneFilter = searchParams.get("zone")?.toLowerCase() || null;
  const limitParam = parseInt(searchParams.get("limit") || "0", 10);

  // ── Load from Wasabi cache ────────────────────────────
  let cached: CachedResult;
  try {
    cached = await readWasabiJson<CachedResult>(`cache/movers_${model}.json`);
  } catch {
    return Response.json({ error: "Data not available — cache may be warming, try again shortly." }, { status: 503 });
  }

  // ── Filter ────────────────────────────────────────────
  let movers = cached.movers as MoverRow[];

  if (classFilter) {
    movers = movers.filter(m => String(m.assetClass || "").toLowerCase() === classFilter);
  }
  if (directionFilter) {
    movers = movers.filter(m => String(m.direction || "").toLowerCase() === directionFilter);
  }
  if (zoneFilter) {
    movers = movers.filter(m => String(m.zone || "").toLowerCase().includes(zoneFilter));
  }
  if (limitParam > 0) {
    movers = movers.slice(0, limitParam);
  }

  return Response.json({
    model,
    count: movers.length,
    totalCount: cached.movers.length,
    dataAsOf: new Date(cached.timestamp).toISOString(),
    movers,
  });
}
