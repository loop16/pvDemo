"use client";

import { useState } from "react";

type Plan = {
    key: "core" | "core_tv";
    name: string;
    price: string;
    description: string;
};

type Props = {
    isActive: boolean;
    plans: Plan[];
    isCorePlan: boolean;
};

export default function AccountActions({ isActive, plans, isCorePlan }: Props) {
    const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState("");

    const handlePortal = async () => {
        setStatus("loading");
        setErrorMessage("");
        try {
            const res = await fetch("/api/stripe/portal", { method: "POST" });
            const data = await res.json();
            if (!res.ok || !data?.url) {
                throw new Error(data?.error || "Unable to open portal.");
            }
            window.location.href = data.url;
        } catch (err: any) {
            setStatus("error");
            setErrorMessage(err?.message || "Unable to open portal.");
        }
    };

    const handleCheckout = async (plan: Plan["key"]) => {
        setStatus("loading");
        setErrorMessage("");
        try {
            const res = await fetch("/api/stripe/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan }),
            });
            const data = await res.json();
            if (!res.ok || !data?.url) {
                throw new Error(data?.error || "Unable to start checkout.");
            }
            window.location.href = data.url;
        } catch (err: any) {
            setStatus("error");
            setErrorMessage(err?.message || "Unable to start checkout.");
        }
    };

    const showPlans = !isActive || isCorePlan;
    const ctaLabel = !isActive ? "Start subscription" : "Upgrade plan";

    return (
        <div className="mt-6 space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
                <button
                    type="button"
                    onClick={handlePortal}
                    disabled={status === "loading"}
                    className="w-full rounded-md border border-neutral-300 bg-white px-4 py-3 text-left text-sm font-semibold text-neutral-900 hover:bg-neutral-50 disabled:opacity-50"
                >
                    <div className="text-xs uppercase tracking-wide text-neutral-500">
                        Billing
                    </div>
                    <div className="text-base">Manage subscription</div>
                    <div className="text-xs font-normal text-neutral-500">
                        Update payment method, cancel, or view invoices.
                    </div>
                </button>

                {showPlans && plans.length > 0 && (
                    <>
                        {plans
                            .filter((plan) => !isActive || (isCorePlan && plan.key === "core_tv"))
                            .map((plan) => (
                            <button
                                key={plan.key}
                                type="button"
                                onClick={() => handleCheckout(plan.key)}
                                disabled={status === "loading"}
                                className="w-full rounded-md bg-black px-4 py-3 text-left text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                            >
                                <div className="text-xs uppercase tracking-wide text-white/70">
                                    {plan.name}
                                </div>
                                <div className="text-base">{plan.price}</div>
                                <div className="text-xs font-normal text-white/80">
                                    {plan.description}
                                </div>
                                <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-white/80">
                                    {ctaLabel}
                                </div>
                            </button>
                        ))}
                    </>
                )}
            </div>

            {status === "error" && (
                <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                    {errorMessage}
                </div>
            )}
        </div>
    );
}
