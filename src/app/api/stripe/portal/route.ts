import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStripe } from "@/lib/stripe";
import { getUser, upsertUserByEmail } from "@/lib/user-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stripe = getStripe();
    const email = session.user.email;

    let user = await getUser(email);
    if (!user) {
        user = await upsertUserByEmail(email, { name: session.user.name ?? undefined });
    }

    let customerId = user.stripeCustomerId ?? null;

    if (customerId) {
        try {
            await stripe.customers.retrieve(customerId);
        } catch {
            customerId = null;
            await upsertUserByEmail(email, { stripeCustomerId: null as any });
        }
    }

    if (!customerId) {
        const customer = await stripe.customers.create({
            email,
            name: session.user.name ?? undefined,
        });
        customerId = customer.id;
        await upsertUserByEmail(email, { stripeCustomerId: customerId });
    }

    const origin =
        req.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000";

    try {
        const portal = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${origin}/account`,
            ...(process.env.STRIPE_PORTAL_CONFIG_ID
                ? { configuration: process.env.STRIPE_PORTAL_CONFIG_ID }
                : {}),
        });
        return NextResponse.json({ url: portal.url });
    } catch (err: any) {
        console.error("[portal] Stripe error:", err?.message);
        return NextResponse.json({ error: err?.message || "Unable to open billing portal." }, { status: 500 });
    }
}
