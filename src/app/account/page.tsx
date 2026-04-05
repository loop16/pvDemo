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
                  price: "$40 / month",
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
            <main className="container-hero max-w-3xl relative z-10" style={{
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(20px) saturate(1.6)',
                WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
                borderRadius: 0,
                border: '1px solid rgba(255,255,255,0.6)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
                marginTop: '24px',
                marginBottom: '40px',
            }}>
                <div className="label mb-4">Account</div>
                <h1 className="mono text-2xl font-bold tracking-tight text-neutral-900">Your subscription</h1>
                <p className="mt-2 text-[15px] text-neutral-500 leading-relaxed">
                    Manage your plan, billing, and access.
                </p>

                {/* Status card */}
                <div className="mt-8 border border-neutral-200 p-6" style={{ background: 'rgba(255,255,255,0.4)' }}>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <p className="label mb-1">Status</p>
                            <p className="mono text-[20px] font-bold text-neutral-900">{statusLabel}</p>
                        </div>
                        <span className={`mono text-[11px] font-semibold uppercase tracking-wider px-3 py-1.5 ${
                            isActive
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-neutral-100 text-neutral-500 border border-neutral-200"
                        }`}>
                            {isActive ? "Access enabled" : "Access locked"}
                        </span>
                    </div>
                    <div className="mt-4 pt-4 border-t border-neutral-100 space-y-1">
                        <p className="text-sm text-neutral-500">
                            Signed in as <span className="mono font-medium text-neutral-900">{session.user.email}</span>
                        </p>
                        <p className="text-sm text-neutral-500">
                            Plan: <span className="mono font-medium text-neutral-900">{planLabel}</span>
                        </p>
                    </div>
                </div>

                <AccountActions isActive={isActive} plans={plans} isCorePlan={isCorePlan} />

                {needsTradingView && (
                    <TradingViewForm
                        planLabel="Core + TV"
                        initialValue={user?.tradingViewUsername ?? ""}
                    />
                )}

                <div className="mt-8">
                    <Link
                        href="/app"
                        className={`mono inline-flex items-center justify-center px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-opacity ${
                            isActive
                                ? "bg-neutral-900 text-white hover:opacity-85"
                                : "pointer-events-none bg-neutral-200 text-neutral-400"
                        }`}
                        aria-disabled={!isActive}
                    >
                        Go to app
                    </Link>
                    {!isActive && (
                        <p className="mt-2 text-xs text-neutral-400 mono">
                            Activate a subscription to unlock the app.
                        </p>
                    )}
                </div>

                {/* Inline footer */}
                <div className="mt-16 border-t border-neutral-200 pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-neutral-400">
                        <Link href="/about" className="hover:text-neutral-700 transition-colors">About</Link>
                        <Link href="/pricing" className="hover:text-neutral-700 transition-colors">Pricing</Link>
                        <Link href="/terms" className="hover:text-neutral-700 transition-colors">Terms</Link>
                        <Link href="/privacy" className="hover:text-neutral-700 transition-colors">Privacy</Link>
                        <a href="mailto:support@price-vault.com" className="hover:text-neutral-700 transition-colors">Contact</a>
                    </nav>
                    <p className="mono text-[11px] text-neutral-400">© 2026 Pricevault</p>
                </div>
            </main>
        </>
    );
}
