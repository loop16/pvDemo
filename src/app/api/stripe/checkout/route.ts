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

  const priceIds = [
    process.env.STRIPE_PRICE_ID_CORE,
    process.env.STRIPE_PRICE_ID_CORE_TV,
    process.env.STRIPE_PRICE_ID,
  ].filter((id): id is string => !!id);

  const body = await req.json().catch(() => ({}));
  const plan = body?.plan === "core" || body?.plan === "core_tv" ? body.plan : null;
  const requestedPriceId = typeof body?.priceId === "string" ? body.priceId : null;
  const planPriceId =
    plan === "core"
      ? process.env.STRIPE_PRICE_ID_CORE
      : plan === "core_tv"
        ? process.env.STRIPE_PRICE_ID_CORE_TV
        : null;
  if (plan && !planPriceId) {
    return NextResponse.json({ error: "Missing price for selected plan" }, { status: 500 });
  }
  const priceId =
    (planPriceId || null) ||
    (requestedPriceId && priceIds.includes(requestedPriceId) && requestedPriceId) ||
    process.env.STRIPE_PRICE_ID_CORE ||
    process.env.STRIPE_PRICE_ID_CORE_TV ||
    process.env.STRIPE_PRICE_ID;

  if (!priceId) {
    return NextResponse.json({ error: "Missing STRIPE_PRICE_ID" }, { status: 500 });
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

  const mode =
    body?.mode === "payment" || body?.mode === "subscription"
      ? body.mode
      : process.env.STRIPE_MODE || "subscription";

  const origin =
    req.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000";

  const isCoreTv = priceId === process.env.STRIPE_PRICE_ID_CORE_TV;

  const checkout = await stripe.checkout.sessions.create({
    mode,
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
}
