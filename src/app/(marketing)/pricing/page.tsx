"use client";

import { useState } from "react";
import Header from "@/components/Header";
import Link from "next/link";

const TIERS = [
  {
    name: "Core",
    price: "$25",
    period: "/mo",
    description: "Unlock every instrument in Pricevault's historical database.",
    bullets: [
      "Daily updates across 1200+ assets",
      "Full quarter-level analytics",
      "Pro + Simple models",
    ],
    cta: { label: "Sign up", href: "/signup" },
    featured: false,
  },
  {
    name: "Core + TradingView",
    price: "$40",
    period: "/mo",
    description: "Everything in Core plus ready-to-use TradingView indicators.",
    bullets: [
      "Includes Core Access",
      "Indicators for EURUSD, SPX, BTC, ETH, NDX, GC, CL, TNX",
      "Priority indicator updates",
    ],
    cta: { label: "Sign up", href: "/signup" },
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "Contact us with your request and we'll tailor a plan for your team.",
    bullets: [],
    cta: { label: "Contact us", href: "mailto:support@price-vault.com?subject=Enterprise%20Plan%20Inquiry" },
    featured: false,
  },
] as const;

const COMPARISON = [
  { feature: "Daily Data Updates", core: true, tv: true },
  { feature: "1,200+ Instruments", core: true, tv: true },
  { feature: "Simple Model", core: true, tv: true },
  { feature: "Pro Model", core: true, tv: true },
  { feature: "Beta Model", core: true, tv: true },
  { feature: "Overlay Model", core: true, tv: true },
  { feature: "Quarter-Level Analytics", core: true, tv: true },
  { feature: "TradingView Indicators", core: false, tv: true },
  { feature: "Priority Updates", core: false, tv: true },
];

export default function PricingPage() {
  const [showComparison, setShowComparison] = useState(false);

  return (
    <>
      <Header />

      <main className="container-hero max-w-6xl relative z-10" style={{
        background: 'rgba(255,255,255,0.15)',
        backdropFilter: 'blur(20px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
        borderRadius: 0,
        border: '1px solid rgba(255,255,255,0.6)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
        marginTop: '24px',
        marginBottom: '40px',
      }}>
        <section className="text-center">
          <div className="label mb-4">Pricing</div>
          <h1 className="serif text-[42px] md:text-[54px] leading-[1.08] text-neutral-900">
            Flexible plans that scale for
            <br />
            <span style={{ color: '#003087' }}><em>Everyone</em></span>
          </h1>
        </section>

        {/* Cards — featured card is visually larger */}
        <div className="mt-14 flex flex-col md:flex-row items-stretch justify-center gap-0">
          {TIERS.map((tier) => (
            <article
              key={tier.name}
              className={`pricing-card border border-neutral-200 flex flex-col -ml-px first:ml-0 transition-all ${
                tier.featured
                  ? "bg-neutral-900 text-white border-neutral-900 z-10 md:-my-4 md:py-10 px-8 flex-1 md:max-w-[380px]"
                  : "bg-white p-6 flex-1 md:max-w-[320px]"
              }`}
              style={tier.featured ? { padding: tier.featured ? '2.5rem 2rem' : undefined } : undefined}
            >
              {tier.featured && (
                <div className="mono text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-3">
                  Most Popular
                </div>
              )}

              <header className="mb-4">
                <h2 className={`mono text-[16px] font-semibold tracking-tight ${tier.featured ? 'text-white' : ''}`}>
                  {tier.name}
                </h2>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className={`mono text-[32px] font-bold ${tier.featured ? 'text-white' : ''}`}>{tier.price}</span>
                  {tier.period && (
                    <span className={`mono text-sm ${tier.featured ? 'text-neutral-400' : 'text-neutral-400'}`}>
                      {tier.period}
                    </span>
                  )}
                </div>
                <p className={`mt-3 text-sm leading-relaxed ${tier.featured ? 'text-neutral-300' : 'text-neutral-500'}`}>
                  {tier.description}
                </p>
              </header>

              <ul className={`mt-3 flex-1 space-y-2 text-sm ${tier.featured ? 'text-neutral-300' : 'text-neutral-600'}`}>
                {tier.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2">
                    <span className={`mono mt-0.5 text-xs select-none ${tier.featured ? 'text-neutral-500' : 'text-neutral-400'}`}>&mdash;</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <Link
                  href={tier.cta.href}
                  className={`mono inline-flex items-center justify-center px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-opacity ${
                    tier.featured
                      ? "border border-white bg-white text-neutral-900 hover:opacity-90"
                      : "border border-neutral-300 text-neutral-600 hover:border-neutral-900 hover:text-neutral-900"
                  }`}
                >
                  {tier.cta.label}
                </Link>
              </div>
            </article>
          ))}
        </div>

        {/* Comparison toggle */}
        <div className="mt-10 text-center">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="mono text-[11px] font-semibold uppercase tracking-wider text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            {showComparison ? "Hide comparison" : "Compare plans"} {showComparison ? "\u2191" : "\u2193"}
          </button>
        </div>

        {/* Comparison table */}
        {showComparison && (
          <div className="mt-6 border border-neutral-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="text-left py-3 px-4 label">Feature</th>
                  <th className="text-center py-3 px-4 label">Core</th>
                  <th className="text-center py-3 px-4 label">Core + TV</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={row.feature} className={i < COMPARISON.length - 1 ? "border-b border-neutral-100" : ""}>
                    <td className="py-3 px-4 text-neutral-600">{row.feature}</td>
                    <td className="py-3 px-4 text-center mono text-[13px]">
                      {row.core
                        ? <span className="text-green-600">&check;</span>
                        : <span className="text-neutral-300">&mdash;</span>
                      }
                    </td>
                    <td className="py-3 px-4 text-center mono text-[13px]">
                      {row.tv
                        ? <span className="text-green-600">&check;</span>
                        : <span className="text-neutral-300">&mdash;</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mono mt-10 text-[11px] text-neutral-700 text-center tracking-wide">
          Prices in USD. Cancel anytime. TradingView indicators require an active TradingView account.
        </p>

        {/* Inline footer */}
        <div className="mt-10 border-t border-neutral-200 pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-neutral-400">
            <Link href="/about" className="hover:text-neutral-700 transition-colors">About</Link>
            <Link href="/models" className="hover:text-neutral-700 transition-colors">Models</Link>
            <Link href="/demo" className="hover:text-neutral-700 transition-colors">Demo</Link>
            <Link href="/terms" className="hover:text-neutral-700 transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-neutral-700 transition-colors">Privacy</Link>
            <a href="mailto:support@price-vault.com" className="hover:text-neutral-700 transition-colors">Contact</a>
          </nav>
          <p className="mono text-[11px] text-neutral-400">© 2026 Pricevault. Not financial advice.</p>
        </div>
      </main>
    </>
  );
}
