import { NextRequest, NextResponse } from "next/server";
import { consumeVerificationToken } from "@/lib/email-verification-tokens";
import { upsertUserByEmail } from "@/lib/user-store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";

  if (!token) {
    return NextResponse.redirect(new URL("/verify-email?error=missing", req.url));
  }

  const email = await consumeVerificationToken(token);

  if (!email) {
    return NextResponse.redirect(new URL("/verify-email?error=invalid", req.url));
  }

  await upsertUserByEmail(email, { emailVerified: true });

  return NextResponse.redirect(new URL("/verify-email?success=1", req.url));
}
