import { NextResponse } from "next/server";
import { z } from "zod";
import { createUser } from "@/lib/user-store";
import { isAllowed, getClientIp } from "@/lib/rate-limit";
import { createVerificationToken } from "@/lib/email-verification-tokens";
import { sendVerificationEmail } from "@/lib/email";

export const runtime = "nodejs";

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

export async function POST(req: Request) {
  // 5 signups per IP per hour
  if (!isAllowed(`signup:${getClientIp(req)}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests, please try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid signup data" }, { status: 400 });
  }

  try {
    const user = await createUser(parsed.data.email, parsed.data.password, parsed.data.name);

    // Send verification email non-blocking
    createVerificationToken(user.email)
      .then((token) => {
        const baseUrl = process.env.NEXTAUTH_URL || "https://price-vault.com";
        const verifyUrl = `${baseUrl}/verify-email?token=${token}`;
        return sendVerificationEmail(user.email, verifyUrl);
      })
      .catch((err) => console.error("[signup] Failed to send verification email:", err));

    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  } catch (err: any) {
    const msg = typeof err?.message === "string" ? err.message : "Unable to create user";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
