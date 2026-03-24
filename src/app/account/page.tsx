import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import { getUser } from "@/lib/user-store";
import AccountActions from "@/components/AccountActions";
import Link from "next/link";
import TradingViewForm from "@/components/TradingViewForm";

export default async function AccountPage() {
    const session = await auth();
    if (!session?.user?.email) {
        redirect("/login");
    }

    const user = await getUser(session.user.email);
    const status = user?.stripeSubscriptionStatus ?? "none";
    const isActive = !!user?.stripePaid;

    const corePriceId = process.env.STRIPE_PRICE_ID_CORE;
    const coreTvPriceId = process.env.STRIPE_PRICE_ID_CORE_TV;
    const plans = [
        corePriceId
            ? {
                  key: "core" as const,
                  name: "Core",
                  price: "$25 / month",
                  description: "Core data + analytics",
              }
            : null,
        coreTvPriceId
            ? {
                  key: "core_tv" as const,
                  name: "Core + TV",
                  price: "$35 / month",
                  description: "Core plus TradingView integration",
              }
            : null,
    ].filter((plan): plan is NonNullable<typeof plan> => !!plan);

    const planLabel =
        user?.stripePriceId === coreTvPriceId
            ? "Core + TV"
            : user?.stripePriceId === corePriceId
                ? "Core"
                : user?.stripePriceId
                    ? "Custom plan"
                    : "No plan selected";
    const needsTradingView = user?.stripePriceId === coreTvPriceId;
    const isCorePlan = user?.stripePriceId === corePriceId;

    const statusLabel = isActive
        ? "Active"
        : status === "trialing"
            ? "Trialing"
            : status === "past_due"
                ? "Past due"
                : status === "canceled"
                    ? "Canceled"
                    : "No active subscription";

    return (
        <>
            <Header />
            <main className="container-hero max-w-3xl">
                <section className="card">
                    <h1 className="text-2xl font-semibold">Your subscription</h1>
                    <p className="mt-2 text-sm text-neutral-600">
                        Manage your plan, billing, and access.
                    </p>

                    <div className="mt-6 rounded-lg border border-neutral-200 p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-neutral-500">
                                    Status
                                </p>
                                <p className="text-lg font-semibold text-neutral-900">
                                    {statusLabel}
                                </p>
                            </div>
                            <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                    isActive
                                        ? "bg-emerald-50 text-emerald-700"
                                        : "bg-neutral-100 text-neutral-600"
                                }`}
                            >
                                {isActive ? "Access enabled" : "Access locked"}
                            </span>
                        </div>
                        <p className="mt-3 text-sm text-neutral-600">
                            Signed in as{" "}
                            <span className="font-medium text-neutral-900">{session.user.email}</span>
                        </p>
                        <p className="mt-1 text-sm text-neutral-600">
                            Plan:{" "}
                            <span className="font-medium text-neutral-900">{planLabel}</span>
                        </p>
                    </div>

                    <AccountActions isActive={isActive} plans={plans} isCorePlan={isCorePlan} />

                    {needsTradingView && (
                        <TradingViewForm
                            planLabel="Core + TV"
                            initialValue={user?.tradingViewUsername ?? ""}
                        />
                    )}

                    <div className="mt-6">
                        <Link
                            href="/app"
                            className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold ${
                                isActive
                                    ? "bg-black text-white hover:opacity-90"
                                    : "pointer-events-none bg-neutral-200 text-neutral-500"
                            }`}
                            aria-disabled={!isActive}
                        >
                            Go to app
                        </Link>
                        {!isActive && (
                            <p className="mt-2 text-xs text-neutral-500">
                                Activate a subscription to unlock the app.
                            </p>
                        )}
                    </div>
                </section>
            </main>
        </>
    );
}
