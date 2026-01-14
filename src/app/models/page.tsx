import Link from "next/link";

export default function ModelsPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 space-y-12">
      <section className="space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900">Analysis Models</h1>
        <p className="text-lg text-neutral-700 leading-relaxed">
          Pricevault offers four distinct models for analyzing price levels, each designed for different use cases and trading styles. Choose the model that best fits your analysis needs.
        </p>
      </section>

      <div className="space-y-6">
        <article className="card space-y-3">
          <h2 className="text-xl font-semibold">Simple Model</h2>
          <p className="text-sm text-neutral-700 leading-relaxed">
            The Simple model provides a streamlined view with essential price levels from a simplified level set. It automatically detects the most likely scenario (long or short) based on current price action and displays individual level lines. Perfect for quick analysis and traders who prefer a clean, uncluttered chart view.
          </p>
          <ul className="text-sm text-neutral-700 space-y-1 list-disc list-inside">
            <li>Uses simplified level set (basic_levels.json)</li>
            <li>Auto-detects scenario from price action</li>
            <li>Renders individual level lines</li>
            <li>Best for: Quick analysis and clean visualizations</li>
          </ul>
        </article>

        <article className="card space-y-3">
          <h2 className="text-xl font-semibold">Pro Model</h2>
          <p className="text-sm text-neutral-700 leading-relaxed">
            The Pro model delivers comprehensive analysis with the full level set, including scenario-based probability boxes and mid-cycle bands. You can manually select the outcome scenario for the latest quarter (Long True, Long False, Short True, Short False, or Auto-detect), giving you control over which probability zones to display.
          </p>
          <ul className="text-sm text-neutral-700 space-y-1 list-disc list-inside">
            <li>Uses comprehensive level set (levels.json)</li>
            <li>Manual outcome selection for latest quarter</li>
            <li>Renders probability boxes and mid bands</li>
            <li>Best for: Detailed analysis and scenario planning</li>
          </ul>
        </article>

        <article className="card space-y-3">
          <h2 className="text-xl font-semibold">Beta Model</h2>
          <p className="text-sm text-neutral-700 leading-relaxed">
            The Beta model scales SPX (S&P 500) benchmark levels to other assets using volatility ratio rather than traditional beta. This approach preserves the unconditional width of probability bands even for assets with low correlation to the market. The model computes the volatility ratio (σ_asset / σ_SPX) over a 1,250-day lookback period and scales each SPX percentage level accordingly. For example, if SPX has a +5% level and the asset's volatility ratio is 1.5, the asset level becomes +7.5%.
          </p>
          <ul className="text-sm text-neutral-700 space-y-1 list-disc list-inside">
            <li>Scales SPX levels using volatility ratio (not traditional beta)</li>
            <li>1,250-day lookback window for volatility calculation</li>
            <li>Volatility ratio clamped between 0.2x and 5x for stability</li>
            <li>Renders probability boxes and mid bands (like Pro)</li>
            <li>Best for: Assets with varying correlation to SPX</li>
          </ul>
        </article>

        <article className="card space-y-3">
          <h2 className="text-xl font-semibold">Overlay Model</h2>
          <p className="text-sm text-neutral-700 leading-relaxed">
            The Overlay model allows you to display levels from a different symbol overlaid on your current chart. This is useful for comparative analysis, such as viewing SPX levels while analyzing NQ, or comparing correlated instruments. The overlay uses Pro model levels from the selected symbol and renders them alongside your primary chart data.
          </p>
          <ul className="text-sm text-neutral-700 space-y-1 list-disc list-inside">
            <li>Displays levels from a different symbol</li>
            <li>Uses Pro model levels for the overlay symbol</li>
            <li>Renders probability boxes and mid bands</li>
            <li>Best for: Comparative analysis and correlation studies</li>
          </ul>
        </article>
      </div>

      <section className="flex flex-wrap gap-4">
        <Link
          href="/about"
          className="rounded-pill border border-neutral-300 px-5 py-3 text-sm font-semibold hover:bg-neutral-50"
        >
          Back to About
        </Link>
        <Link
          href="/pricing"
          className="rounded-pill bg-black px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
        >
          Explore pricing
        </Link>
      </section>
    </main>
  );
}

