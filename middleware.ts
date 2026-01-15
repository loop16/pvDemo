import { NextResponse } from "next/server";
import { auth } from "@/auth";

const PUBLIC_DEMO_APIS = new Set(["/api/levels", "/api/ohlcv", "/api/symbols"]);

function isDemoApiRequest(req: Request) {
    const url = new URL(req.url);
    return PUBLIC_DEMO_APIS.has(url.pathname) && url.searchParams.get("source") === "demo";
}

export default auth((req) => {
    if (isDemoApiRequest(req)) return NextResponse.next();

    if (!req.auth) {
        const loginUrl = new URL("/login", req.nextUrl.origin);
        loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
});

export const config = {
    matcher: ["/app", "/app/:path*", "/api/levels", "/api/ohlcv", "/api/symbols", "/api/tv/:path*"],
};
