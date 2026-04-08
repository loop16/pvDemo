import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStripe } from "@/lib/stripe";
import { getUser, upsertUserByEmail } from "@/lib/user-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const plan = body?.plan === "core" || body?.plan === "core_tv" ? body.plan : null;
    const planPriceId =
      plan === "core"
        ? process.env.STRIPE_PRICE_ID_CORE
        : plan === "core_tv"
          ? process.env.STRIPE_PRICE_ID_CORE_TV
          : null;

    const priceId =
      planPriceId ||
      process.env.STRIPE_PRICE_ID_CORE ||
      process.env.STRIPE_PRICE_ID_CORE_TV ||
      process.env.STRIPE_PRICE_ID;

    if (!priceId) {
      return NextResponse.json({ error: "No price configured." }, { status: 500 });
    }

    const stripe = getStripe();
    const email = session.user.email;

    let user = await getUser(email);
    if (!user) {
      user = await upsertUserByEmail(email, { name: session.user.name ?? undefined });
    }

    let customerId = user.stripeCustomerId ?? null;

    // Validate stored customer ID — may be stale if switched from test to live mode
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
      req.headers.get("origin") || process.env.NEXTAUTH_URL || "https://price-vault.com";

    const isCoreTv = priceId === process.env.STRIPE_PRICE_ID_CORE_TV;

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${origin}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/subscribe`,
      ...(isCoreTv && {
        custom_fields: [
          {
            key: "tradingview_username",
            label: { type: "custom", custom: "TradingView Username" },
            type: "text",
            optional: true,
          },
        ],
      }),
    });

    await upsertUserByEmail(email, { stripeCheckoutSessionId: checkout.id, stripePriceId: priceId });
    return NextResponse.json({ url: checkout.url });

  } catch (err: any) {
    console.error("[checkout] error:", err?.message);
    return NextResponse.json({ error: err?.message || "Unable to start checkout." }, { status: 500 });
  }
}
