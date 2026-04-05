import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { updateUserByStripeCustomerId } from "@/lib/user-store";
import { sendWelcomeEmail, sendPaymentFailedEmail, sendCancellationEmail } from "@/lib/email";

export const runtime = "nodejs";

function normalizeCustomerId(customer: Stripe.Invoice["customer"] | Stripe.Subscription["customer"] | Stripe.Checkout.Session["customer"]) {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return NextResponse.json({ error: "Missing webhook signature" }, { status: 400 });
  }

  const stripe = getStripe();
  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = normalizeCustomerId(session.customer);
      const tvField = session.custom_fields?.find((f) => f.key === "tradingview_username");
      const tradingViewUsername = tvField?.text?.value?.trim() || undefined;
      if (customerId) {
        await updateUserByStripeCustomerId(customerId, {
          stripePaid: true,
          stripeSubscriptionStatus: session.mode === "subscription" ? "active" : "paid",
          stripeCheckoutSessionId: session.id,
          ...(tradingViewUsername ? { tradingViewUsername } : {}),
        });
      }
      const email = session.customer_details?.email ?? session.customer_email;
      if (email) {
        sendWelcomeEmail(email).catch((err) =>
          console.error("[webhook] Failed to send welcome email:", err),
        );
      }
      break;
    }
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = normalizeCustomerId(invoice.customer);
      if (customerId) {
        await updateUserByStripeCustomerId(customerId, {
          stripePaid: true,
          stripeSubscriptionStatus: "active",
        });
      }
      break;
    }
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = normalizeCustomerId(subscription.customer);
      const priceId = subscription.items?.data?.[0]?.price?.id;
      if (customerId) {
        await updateUserByStripeCustomerId(customerId, {
          stripePaid: subscription.status === "active" || subscription.status === "trialing",
          stripeSubscriptionStatus: subscription.status,
          ...(priceId ? { stripePriceId: priceId } : {}),
        });
      }
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = normalizeCustomerId(subscription.customer);
      if (customerId) {
        const updated = await updateUserByStripeCustomerId(customerId, {
          stripePaid: false,
          stripeSubscriptionStatus: "canceled",
        });
        if (updated?.email) {
          sendCancellationEmail(updated.email).catch((err) =>
            console.error("[webhook] Failed to send cancellation email:", err),
          );
        }
      }
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = normalizeCustomerId(invoice.customer);
      if (customerId) {
        const user = await updateUserByStripeCustomerId(customerId, {
          stripeSubscriptionStatus: "past_due",
        });
        if (user?.email) {
          sendPaymentFailedEmail(user.email).catch((err) =>
            console.error("[webhook] Failed to send payment failed email:", err),
          );
        }
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
