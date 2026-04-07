"use client";

import { useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";

const MODELS = [
  {
    id: "simple",
    name: "Simple",
    headline: "Clean levels, auto-detected scenario",
    description: "The Simple model provides a streamlined view with essential price levels from a simplified level set. It automatically detects the most likely scenario (long or short) based on current price action and displays individual level lines. Perfect for quick analysis and traders who prefer a clean, uncluttered chart view.",
    features: [
      "Uses simplified level set",
      "Auto-detects scenario from price action",
      "Renders individual level lines",
      "Best for: Quick analysis and clean visualizations",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    headline: "Full level set with scenario control",
    description: "The Pro model delivers comprehensive analysis with the full level set, including scenario-based probability boxes and mid-cycle bands. You can manually select the outcome scenario for the latest quarter (Long True, Long False, Short True, Short False, or Auto-detect), giving you control over which probability zones to display.",
    features: [
      "Uses comprehensive level set",
      "Manual outcome selection for latest quarter",
      "Renders probability boxes and mid bands",
      "Best for: Detailed analysis and scenario planning",
    ],
  },
  {
    id: "beta",
    name: "Beta",
    headline: "SPX-scaled volatility levels",
    description: "The Beta model scales SPX (S&P 500) benchmark levels to other assets using volatility ratio rather than traditional beta. This approach preserves the unconditional width of probability bands even for assets with low correlation to the market. The model computes the volatility ratio over a 1,250-day lookback period and scales each SPX percentage level accordingly.",
    features: [
      "Scales SPX levels using volatility ratio (not traditional beta)",
      "1,250-day lookback window for volatility calculation",
      "Volatility ratio clamped between 0.2x and 5x for stability",
      "Best for: Assets with varying correlation to SPX",
    ],
  },
  {
    id: "overlay",
    name: "Overlay",
    headline: "Cross-symbol level comparison",
    description: "The Overlay model allows you to display levels from a different symbol overlaid on your current chart. This is useful for comparative analysis, such as viewing SPX levels while analyzing NQ, or comparing correlated instruments. The overlay uses Pro model levels from the selected symbol and renders them alongside your primary chart's native levels for direct visual comparison.",
    features: [
      "Displays levels from a different symbol",
      "Uses Pro model levels for the overlay symbol",
      "Renders probability boxes and mid bands",
      "Best for: Comparative analysis and correlation studies",
    ],
  },
];

export default function ModelsPage() {
  const [activeId, setActiveId] = useState("simple");
  const active = MODELS.find((m) => m.id === activeId)!;

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
        <section className="space-y-4">
          <div className="label">Documentation</div>
          <h1 className="mono text-2xl font-bold tracking-tight text-neutral-900">Analysis Models</h1>
          <p className="text-[15px] text-neutral-500 leading-relaxed max-w-3xl">
            Four distinct models for analyzing price levels. Select one below.
          </p>
          <p className="mono text-[11px] text-neutral-400 uppercase tracking-widest">Data updates daily after market close</p>
        </section>

        {/* Tab bar */}
        <div className="mt-12 flex border-b border-neutral-200">
          {MODELS.map((model) => (
            <button
              key={model.id}
              onClick={() => setActiveId(model.id)}
              className={`mono text-[12px] font-semibold uppercase tracking-wider px-6 py-3 transition-colors border-b-2 -mb-px ${
                activeId === model.id
                  ? "border-neutral-900 text-neutral-900"
                  : "border-transparent text-neutral-400 hover:text-neutral-600"
              }`}
            >
              {model.name}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="border border-t-0 border-neutral-200 p-8 md:p-12" key={activeId} style={{ minHeight: 380 }}>
          <div className="mono text-[11px] uppercase tracking-widest text-neutral-400 mb-2">
            {active.name} Model
          </div>
          <h2 className="mono text-[20px] md:text-[24px] font-bold mb-4" style={{ letterSpacing: '-0.02em' }}>
            {active.headline}
          </h2>
          <p className="text-[15px] text-neutral-500 leading-relaxed max-w-2xl mb-8">
            {active.description}
          </p>

          <div className="border-t border-neutral-200 pt-6">
            <div className="label mb-4">Capabilities</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {active.features.map((f) => (
                <div key={f} className="flex items-start gap-3 text-sm text-neutral-600">
                  <span className="mono text-neutral-400 mt-0.5 text-xs select-none shrink-0">&mdash;</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <section className="mt-14 flex flex-wrap gap-3">
          <Link
            href="/about"
            className="mono border border-neutral-300 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-600 hover:border-neutral-900 hover:text-neutral-900 transition-colors"
          >
            Back to About
          </Link>
          <Link
            href="/pricing"
            className="mono border border-neutral-900 bg-neutral-900 text-white px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider hover:opacity-85 transition-opacity"
          >
            Explore pricing
          </Link>
        </section>

        {/* Inline footer */}
        <div className="mt-16 border-t border-neutral-200 pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-neutral-400">
            <Link href="/about" className="hover:text-neutral-700 transition-colors">About</Link>
            <Link href="/pricing" className="hover:text-neutral-700 transition-colors">Pricing</Link>
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
