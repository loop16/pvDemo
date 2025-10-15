import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 space-y-12">
      <section className="space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900">About Pricevault</h1>
        <p className="text-lg text-neutral-700 leading-relaxed">
          Pricevault gives discretionary traders institutional-grade probability levels, mid-cycle context, and TradingView overlays without having to build a quant desk. We ingest end-of-day data across global markets, recompute quarter models nightly, and surface the zones that matter every morning.
        </p>
      </section>

      <section className="grid gap-8 md:grid-cols-2">
        <article className="card space-y-3">
          <h2 className="text-xl font-semibold">What’s inside</h2>
          <ul className="space-y-2 text-sm text-neutral-700">
            <li><strong>Quarter models</strong> — simple + pro scenarios refreshed at every EOD close.</li>
            <li><strong>Full instrument library</strong> — equities, futures, FX, and crypto back to 1960 where available.</li>
            <li><strong>Indicators package</strong> — TradingView overlays for EURUSD, SPX, BTC, ETH, NDX, GC, CL, TNX.</li>
            <li><strong>Workflow friendly</strong> — export snapshots, add notes, and share setups with your team.</li>
          </ul>
        </article>

        <article className="card space-y-3">
          <h2 className="text-xl font-semibold">Why we built it</h2>
          <p className="text-sm text-neutral-700 leading-relaxed">
            We ran the same process on prop desks: align the quarter, map the upside/downside, and brief the team before the opening bell. Pricevault packages that workflow so macro desks, hedge funds, and focused independents can ship faster. One shared playbook, zero spreadsheet chaos.
          </p>
          <p className="text-sm text-neutral-700 leading-relaxed">
            Need white-label data, enterprise onboarding, or custom indicators? Let us know—we support institutional deployments as well.
          </p>
        </article>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">What we’re not</h2>
        <ul className="space-y-2 text-sm text-neutral-700">
          <li>We are not a signal room or copy-trading platform.</li>
          <li>We do not redistribute real-time exchange data—Pricevault operates on delayed/EOD feeds.</li>
          <li>This is not investment advice. We surface probabilities; you execute the plan.</li>
        </ul>
      </section>

      <section className="flex flex-wrap gap-4">
        <Link
          href="/pricing"
          className="rounded-pill bg-black px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
        >
          Explore pricing
        </Link>
        <Link
          href="/signup"
          className="rounded-pill border border-neutral-300 px-5 py-3 text-sm font-semibold hover:bg-neutral-50"
        >
          Join the waitlist
        </Link>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Disclaimers</h2>
        <div className="space-y-3 text-sm text-neutral-700 leading-relaxed">
          <p><strong>Education Only / No Advice.</strong> Pricevault is for educational and informational purposes only. Nothing on this site is investment, tax, accounting, or legal advice, and nothing is a recommendation or solicitation to buy or sell any security, futures contract, option, cryptocurrency, or instrument.</p>
          <p><strong>No Registration / Independence.</strong> Pricevault is not a broker-dealer, investment adviser, commodity trading advisor (CTA), or commodity pool operator (CPO), and does not accept customer funds or provide trade execution.</p>
          <p><strong>Risk Disclosure.</strong> Trading involves substantial risk of loss and is not suitable for all investors. Futures, options, and leveraged products involve significant risk and may result in losses greater than your initial investment. Only risk capital should be used.</p>
          <p><strong>U.S. Government Required Disclaimer.</strong> Futures and options trading has large potential rewards, but also large potential risk. Do not trade with money you cannot afford to lose. No representation is being made that any account will or is likely to achieve profits or losses similar to those discussed. Past performance is not indicative of future results.</p>
          <p><strong>CFTC Rule 4.41 – Hypothetical/Simulated Performance.</strong> Hypothetical or simulated performance results have inherent limitations. Since the trades have not been executed, results may differ materially from live trading. Simulated trading programs are designed with the benefit of hindsight and do not capture liquidity, slippage, or psychological factors. No representation is being made that any account will or is likely to achieve profits or losses similar to those shown.</p>
          <p><strong>Backtests, Models, and Patterns.</strong> Any backtested results, model outputs, or pattern detections reflect assumptions and are provided for research illustration. Methodologies, parameters, and datasets may change without notice. Results may differ materially when applied in live markets.</p>
          <p><strong>Data Accuracy & Availability.</strong> Data is provided “as is” and “as available.” It may be delayed, incomplete, inaccurate, or unavailable from time to time. Pricevault and its data providers do not guarantee the accuracy, timeliness, or completeness of any data and are not liable for errors, omissions, or interruptions.</p>
          <p><strong>Market-Data Licensing.</strong> Market data and content are the property of their respective owners and/or exchanges. Redistribution, reproduction, or display beyond this site is prohibited without permission. If an instrument is shown with delayed data, the delay may vary by exchange and product.</p>
          <p><strong>No Reliance / User Responsibility.</strong> You are solely responsible for evaluating the information on this site and for any trading decisions. Always conduct your own research and consult a licensed professional where appropriate.</p>
          <p><strong>Affiliations & Conflicts.</strong> Some pages may reference partners or contain affiliate links. We may receive compensation if you click or transact, which may create a conflict of interest. We do not accept compensation to promote specific trades or instruments.</p>
          <p><strong>Testimonials.</strong> Any testimonials or reviews may not be representative of other clients and are not a guarantee of future performance or success.</p>
          <p><strong>Limitation of Liability.</strong> To the fullest extent permitted by law, Pricevault, its owners, and affiliates disclaim any liability for direct, indirect, incidental, consequential, or special damages arising out of or in connection with the use of the site, data, models, or content.</p>
        </div>
      </section>

    </main>
  );
}
