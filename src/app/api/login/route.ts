import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { code } = await req.json();
  const ok = code === (process.env.DEMO_ACCESS_CODE || "demo");
  if (!ok) return NextResponse.json({ ok: false }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set("auth", "1", { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}

