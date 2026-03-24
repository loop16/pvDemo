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

    let customerId = user.stripeCustomerId;
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

    const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${origin}/account`,
    });

    return NextResponse.json({ url: portal.url });
}
