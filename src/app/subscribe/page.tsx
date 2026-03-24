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
      <main className="container-hero max-w-3xl">
        <section className="card">
          <h1 className="text-2xl font-semibold">Activate your access</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Complete your subscription to unlock the full Pricevault platform.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">Core</p>
                  <p className="text-xs text-neutral-500">Monthly billing</p>
                </div>
                <p className="text-lg font-semibold">$25 / month</p>
              </div>
              <ul className="mt-4 text-sm text-neutral-700 space-y-1">
                <li>Full historical data access</li>
                <li>Daily updates across 1200+ assets</li>
                <li>All quarter-level analytics</li>
              </ul>
              <button
                type="button"
                onClick={() => handleCheckout("core")}
                disabled={status === "loading"}
                className="mt-4 w-full rounded-md bg-black py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {status === "loading" ? "Redirecting..." : "Choose Core"}
              </button>
            </div>

            <div className="rounded-lg border border-neutral-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">Core + TV</p>
                  <p className="text-xs text-neutral-500">Monthly billing</p>
                </div>
                <p className="text-lg font-semibold">$35 / month</p>
              </div>
              <ul className="mt-4 text-sm text-neutral-700 space-y-1">
                <li>Everything in Core</li>
                <li>TradingView integration</li>
                <li>Extended signal delivery</li>
              </ul>
              <button
                type="button"
                onClick={() => handleCheckout("core_tv")}
                disabled={status === "loading"}
                className="mt-4 w-full rounded-md bg-black py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {status === "loading" ? "Redirecting..." : "Choose Core + TV"}
              </button>
            </div>
          </div>

          {status === "error" && (
            <div className="mt-4 rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
              {errorMessage}
            </div>
          )}

          <p className="mt-4 text-xs text-neutral-500">
            Have questions?{" "}
            <Link href="/about" className="underline underline-offset-4">
              Contact the team
            </Link>
            .
          </p>
        </section>
      </main>
    </>
  );
}
