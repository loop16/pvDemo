import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/user-store";
import { createResetToken } from "@/lib/reset-tokens";
import { sendPasswordResetEmail } from "@/lib/email";
import { isAllowed, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // 3 reset requests per IP per hour
  if (!isAllowed(`reset-request:${getClientIp(req)}`, 3, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests, please try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
  }

  // Always return 200 — never reveal whether the email exists
  const user = await getUser(email).catch(() => null);

  if (user && user.passwordHash) {
    // Only send reset for password-based accounts (Google users have no password to reset)
    try {
      const token = await createResetToken(email);
      const baseUrl = process.env.NEXTAUTH_URL || "https://price-vault.com";
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;
      await sendPasswordResetEmail(email, resetUrl);
    } catch (err) {
      console.error("[reset-password] Failed to send reset email:", err);
      // Still return 200 — don't leak error details to the client
    }
  }

  return NextResponse.json({
    ok: true,
    message: "If that email has an account, a reset link is on its way.",
  });
}
