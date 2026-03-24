import { NextResponse } from "next/server";
import { z } from "zod";
import { createUser } from "@/lib/user-store";

export const runtime = "nodejs";

const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
  name: z.string().optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid signup data" }, { status: 400 });
  }

  try {
    const user = await createUser(parsed.data.email, parsed.data.password, parsed.data.name);
    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  } catch (err: any) {
    const msg = typeof err?.message === "string" ? err.message : "Unable to create user";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
