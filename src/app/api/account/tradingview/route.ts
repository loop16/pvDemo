import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { upsertUserByEmail } from "@/lib/user-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const raw = typeof body?.username === "string" ? body.username : "";
  const username = raw.trim();

  if (!username) {
    return NextResponse.json({ error: "TradingView username is required." }, { status: 400 });
  }
  if (username.length > 50) {
    return NextResponse.json({ error: "Username is too long." }, { status: 400 });
  }

  await upsertUserByEmail(session.user.email, { tradingViewUsername: username });
  return NextResponse.json({ ok: true });
}
