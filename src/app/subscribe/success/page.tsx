import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getStripe } from "@/lib/stripe";
import { upsertUserByEmail, updateUserByStripeCustomerId } from "@/lib/user-store";

type SearchParams = {
  session_id?: string | string[];
};

export const runtime = "nodejs";

export default async function SubscribeSuccessPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/login");
  }

  const params = await searchParams;
  const sessionId = Array.isArray(params?.session_id)
    ? params?.session_id[0]
    : params?.session_id;
  if (!sessionId) {
    redirect("/subscribe");
  }

  const stripe = getStripe();
  const checkout = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["customer", "line_items"],
  });

  const checkoutEmail =
    checkout.customer_details?.email ||
    checkout.customer_email ||
    (typeof checkout.customer === "string" ? null : (checkout.customer as any)?.email);

  if (checkoutEmail && checkoutEmail !== session.user.email) {
    redirect("/subscribe");
  }

  const isPaid = checkout.payment_status === "paid" || checkout.status === "complete";
  const customerId =
    typeof checkout.customer === "string" ? checkout.customer : checkout.customer?.id;
  const priceId = checkout.line_items?.data?.[0]?.price?.id;

  if (isPaid) {
    if (customerId) {
      await updateUserByStripeCustomerId(customerId, {
        stripePaid: true,
        stripeSubscriptionStatus: checkout.mode === "subscription" ? "active" : "paid",
        stripeCheckoutSessionId: checkout.id,
        ...(priceId ? { stripePriceId: priceId } : {}),
      });
    } else {
      await upsertUserByEmail(session.user.email, {
        stripePaid: true,
        stripeSubscriptionStatus: checkout.mode === "subscription" ? "active" : "paid",
        stripeCheckoutSessionId: checkout.id,
        ...(priceId ? { stripePriceId: priceId } : {}),
      });
    }
  }

  return (
    <main className="container-hero max-w-2xl">
      <section className="card text-center">
        <h1 className="text-2xl font-semibold">
          {isPaid ? "Payment received" : "We're finalizing your payment"}
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          {isPaid
            ? "Your subscription is active. You can head straight into the platform."
            : "Your checkout is still processing. If this takes longer than a minute, reach out."}
        </p>
        <Link
          href="/app"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-black px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Continue to app
        </Link>
      </section>
    </main>
  );
}
