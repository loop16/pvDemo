import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// These APIs allow unauthenticated access when ?source=demo is passed
const PUBLIC_DEMO_APIS = new Set(["/api/levels", "/api/ohlcv", "/api/symbols", "/api/movers"]);

// These APIs require a paid subscription (beyond just being logged in)
const PAID_APIs = new Set(["/api/levels", "/api/ohlcv", "/api/symbols", "/api/movers", "/api/tv"]);

function isDemoApiRequest(req: NextRequest) {
    return PUBLIC_DEMO_APIS.has(req.nextUrl.pathname) && req.nextUrl.searchParams.get("source") === "demo";
}

function isApiRequest(req: NextRequest) {
    return req.nextUrl.pathname.startsWith("/api/");
}

function isPaidApiRequest(req: NextRequest) {
    const path = req.nextUrl.pathname;
    return Array.from(PAID_APIs).some((p) => path === p || path.startsWith(p + "/"));
}

export default async function middleware(req: NextRequest) {
    // Always allow demo requests through
    if (isDemoApiRequest(req)) return NextResponse.next();

    // Allow admin secret to bypass auth (used for cache warming from scripts)
    const adminSecret = process.env.ADMIN_SECRET;
    if (adminSecret && req.headers.get("x-admin-secret") === adminSecret) {
        return NextResponse.next();
    }

    const token = await getToken({ req, secret: process.env.AUTH_SECRET });

    // No token — unauthenticated
    if (!token) {
        if (isApiRequest(req)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
        return NextResponse.redirect(loginUrl);
    }

    // Logged in but not paid — block paid API routes and the app/terminal
    if (!token.paid) {
        if (isPaidApiRequest(req)) {
            return NextResponse.json(
                { error: "Subscription required", code: "PAYMENT_REQUIRED" },
                { status: 402 }
            );
        }
        const path = req.nextUrl.pathname;
        if (path.startsWith("/app") || path.startsWith("/terminal")) {
            return NextResponse.redirect(new URL("/pricing", req.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/app",
        "/app/:path*",
        "/terminal",
        "/terminal/:path*",
        "/api/levels",
        "/api/ohlcv",
        "/api/symbols",
        "/api/movers",
        "/api/tv/:path*",
    ],
};
