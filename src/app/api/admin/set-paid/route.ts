import { NextRequest, NextResponse } from "next/server";
import { upsertUserByEmail, getUser } from "@/lib/user-store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Protect with a secret header — set ADMIN_SECRET in your env vars
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Admin not configured" }, { status: 503 });
  }
  if (req.headers.get("x-admin-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const paid = typeof body?.paid === "boolean" ? body.paid : true;

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const user = await upsertUserByEmail(email, {
    stripePaid: paid,
    stripeSubscriptionStatus: paid ? "active" : "canceled",
  });

  return NextResponse.json({
    ok: true,
    email: user.email,
    stripePaid: user.stripePaid,
    stripeSubscriptionStatus: user.stripeSubscriptionStatus,
  });
}
