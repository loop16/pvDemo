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
                    className="w-full border border-neutral-200 p-4 text-left transition-colors hover:border-neutral-400 disabled:opacity-50"
                    style={{ background: 'rgba(255,255,255,0.4)' }}
                >
                    <div className="label mb-1">Billing</div>
                    <div className="mono text-[14px] font-semibold text-neutral-900">Manage subscription</div>
                    <div className="mt-1 text-xs text-neutral-500">
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
                                className="w-full bg-neutral-900 p-4 text-left transition-opacity hover:opacity-85 disabled:opacity-50"
                            >
                                <div className="mono text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-1">{plan.name}</div>
                                <div className="mono text-[14px] font-semibold text-white">{plan.price}</div>
                                <div className="mt-1 text-xs text-neutral-400">
                                    {plan.description}
                                </div>
                                <div className="mt-3 mono text-[11px] font-semibold uppercase tracking-wider text-white/70">
                                    {ctaLabel} →
                                </div>
                            </button>
                        ))}
                    </>
                )}
            </div>

            {status === "error" && (
                <div className="mono border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                    {errorMessage}
                </div>
            )}
        </div>
    );
}
