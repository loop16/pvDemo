import { NextRequest } from "next/server";
import path from "path";
import { promises as fs } from "fs";

export const runtime = "nodejs";

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "subscribers.json");

async function readSubscribers(): Promise<Array<{ email: string; subscribedAt: string }>> {
  try {
    const raw = await fs.readFile(dataFile, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((entry) => typeof entry?.email === "string");
    }
    return [];
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

async function writeSubscribers(subscribers: Array<{ email: string; subscribedAt: string }>) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(subscribers, null, 2), "utf-8");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const emailRaw = typeof body?.email === "string" ? body.email : "";
    const email = normalizeEmail(emailRaw);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Please provide a valid email address." }, { status: 400 });
    }

    const subscribers = await readSubscribers();
    const already = subscribers.find((entry) => entry.email === email);
    if (!already) {
      subscribers.push({ email, subscribedAt: new Date().toISOString() });
      await writeSubscribers(subscribers);
    }

    return Response.json({ ok: true, message: "Thanks! We'll be in touch soon." });
  } catch (err) {
    console.error("Failed to store subscriber", err);
    return Response.json({ error: "Unable to save your request right now." }, { status: 500 });
  }
}
