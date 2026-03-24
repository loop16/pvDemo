import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUser, upsertUserByEmail } from "@/lib/user-store";

export const runtime = "nodejs";

export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.redirect(new URL("/login", req.url));
    }

    const email = session.user.email;
    let user = await getUser(email);
    if (!user) {
        user = await upsertUserByEmail(email, { name: session.user.name ?? undefined });
    }

    if (user?.stripePaid) {
        return NextResponse.redirect(new URL("/app", req.url));
    }

    return NextResponse.redirect(new URL("/account", req.url));
}
