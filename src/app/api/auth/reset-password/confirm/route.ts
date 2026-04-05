import { NextRequest, NextResponse } from "next/server";
import { consumeResetToken } from "@/lib/reset-tokens";
import { updatePassword } from "@/lib/user-store";
import { isAllowed, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // 5 attempts per IP per hour (brute-force protection)
  if (!isAllowed(`reset-confirm:${getClientIp(req)}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests, please try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!token) {
    return NextResponse.json({ error: "Missing reset token." }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const email = await consumeResetToken(token);

  if (!email) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Please request a new one." },
      { status: 400 },
    );
  }

  await updatePassword(email, password);

  return NextResponse.json({ ok: true, message: "Password updated. You can now sign in." });
}
