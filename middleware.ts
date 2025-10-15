import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = { matcher: ["/app/:path*"] };

export function middleware(req: NextRequest) {
  const loggedIn = req.cookies.get("auth")?.value === "1";
  if (!loggedIn) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

