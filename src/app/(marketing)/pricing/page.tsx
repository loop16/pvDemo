"use client";

import Header from "@/components/Header";
import Link from "next/link";

const TIERS = [
  {
    name: "Core",
    price: "$25 / month",
    description: "Unlock every instrument in Pricevault’s historical database.",
    bullets: [
      "Daily updates across 1200+ assets",
      "Full quarter-level analytics",
      "Pro + Simple models",
    ],
    cta: {
      label: "Sign up",
      href: "/signup",
    },
    featured: false,
  },
  {
    name: "Core + TradingView",
    price: "$40 / month",
    description: "Everything in Core plus ready-to-use TradingView indicators.",
    bullets: [
      "Includes Core Access",
      "Indicators for EURUSD, SPX, BTC, ETH, NDX, GC, CL, TNX",
      "Priority indicator updates",
    ],
    cta: {
      label: "Sign up",
      href: "/signup",
    },
    featured: true,
  },
  {
    name: "Need More?",
    price: "Custom",
    description: "Contact us with your request and we'll tailor a plan for your team.",
    bullets: [],
    cta: {
      label: "Contact us",
      href: "/signup?plan=custom",
    },
    featured: false,
  },
] as const;

export default function PricingPage() {
  return (
    <>
      <Header />

      <main className="container-hero max-w-6xl">
        <section className="text-center">
          <p className="mt-2 text-neutral-600 text-[40px] md:text-[48px] leading-relaxed max-w-3xl mx-auto font-semibold">
            Flexible subscriptions that scale for
            <br />
            <span className="text-brand font-semibold">Everyone</span>
          </p>
        </section>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {TIERS.map((tier) => (
            <article
              key={tier.name}
              className={`card flex flex-col h-full ${
                tier.featured ? "border-blue-500 shadow-xl" : ""
              }`}
            >
              <header className="mb-4">
                <h2 className="text-[20px] font-semibold tracking-tight">{tier.name}</h2>
                <p className="mt-2 text-[28px] font-bold text-neutral-900">{tier.price}</p>
                <p className="mt-3 text-sm text-neutral-600 leading-relaxed">{tier.description}</p>
              </header>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-neutral-700">
                {tier.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-neutral-900" aria-hidden />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link
                  href={tier.cta.href}
                  className="inline-flex items-center justify-center rounded-pill px-5 py-3 text-sm font-semibold bg-black text-white hover:opacity-90"
                >
                  {tier.cta.label}
                </Link>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-10 text-xs text-neutral-500 text-center">
          Prices in USD. Cancel anytime. TradingView indicators require an active TradingView account.
        </p>
      </main>
    </>
  );
}
