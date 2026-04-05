"use client";

import { useState } from "react";
import Header from "@/components/Header";
import Link from "next/link";

export default function SubscribePage() {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleCheckout = async (plan: "core" | "core_tv") => {
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
      setErrorMessage(err?.message || "Checkout failed. Please try again.");
    }
  };

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
        <div className="label mb-4">Subscribe</div>
        <h1 className="mono text-2xl font-bold tracking-tight text-neutral-900">Activate your access</h1>
        <p className="mt-2 text-[15px] text-neutral-500 leading-relaxed">
          Complete your subscription to unlock the full Pricevault platform.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {/* Core */}
          <div className="border border-neutral-200 p-6" style={{ background: 'rgba(255,255,255,0.4)' }}>
            <div className="label mb-2">Core</div>
            <p className="mono text-[28px] font-bold text-neutral-900">$25<span className="text-[14px] font-normal text-neutral-400"> / mo</span></p>
            <p className="mt-2 text-sm text-neutral-500">Monthly billing</p>
            <ul className="mt-4 space-y-1.5 text-sm text-neutral-600">
              <li className="flex items-start gap-2"><span className="mono text-neutral-400 text-xs mt-0.5">&mdash;</span>Full historical data access</li>
              <li className="flex items-start gap-2"><span className="mono text-neutral-400 text-xs mt-0.5">&mdash;</span>Daily updates across 1200+ assets</li>
              <li className="flex items-start gap-2"><span className="mono text-neutral-400 text-xs mt-0.5">&mdash;</span>All quarter-level analytics</li>
            </ul>
            <button
              type="button"
              onClick={() => handleCheckout("core")}
              disabled={status === "loading"}
              className="mono mt-6 w-full border border-neutral-300 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-700 hover:border-neutral-900 hover:text-neutral-900 transition-colors disabled:opacity-50"
            >
              {status === "loading" ? "Redirecting..." : "Choose Core"}
            </button>
          </div>

          {/* Core + TV */}
          <div className="border border-neutral-900 p-6 bg-neutral-900">
            <div className="mono text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-2">Most Popular</div>
            <p className="mono text-[28px] font-bold text-white">$40<span className="text-[14px] font-normal text-neutral-400"> / mo</span></p>
            <p className="mt-2 text-sm text-neutral-400">Monthly billing</p>
            <ul className="mt-4 space-y-1.5 text-sm text-neutral-300">
              <li className="flex items-start gap-2"><span className="mono text-neutral-500 text-xs mt-0.5">&mdash;</span>Everything in Core</li>
              <li className="flex items-start gap-2"><span className="mono text-neutral-500 text-xs mt-0.5">&mdash;</span>TradingView integration</li>
              <li className="flex items-start gap-2"><span className="mono text-neutral-500 text-xs mt-0.5">&mdash;</span>Priority indicator updates</li>
            </ul>
            <button
              type="button"
              onClick={() => handleCheckout("core_tv")}
              disabled={status === "loading"}
              className="mono mt-6 w-full border border-white bg-white py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-900 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {status === "loading" ? "Redirecting..." : "Choose Core + TV"}
            </button>
          </div>
        </div>

        {status === "error" && (
          <div className="mono mt-4 border border-red-200 bg-red-50 p-3 text-xs text-red-600">
            {errorMessage}
          </div>
        )}

        <p className="mt-6 text-xs text-neutral-400">
          Have questions?{" "}
          <a href="mailto:support@price-vault.com" className="mono underline underline-offset-4 hover:text-neutral-700 transition-colors">
            Contact us
          </a>
        </p>

        <div className="mt-16 border-t border-neutral-200 pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-neutral-400">
            <Link href="/pricing" className="hover:text-neutral-700 transition-colors">Pricing</Link>
            <Link href="/terms" className="hover:text-neutral-700 transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-neutral-700 transition-colors">Privacy</Link>
          </nav>
          <p className="mono text-[11px] text-neutral-400">© 2026 Pricevault</p>
        </div>
      </main>
    </>
  );
}
