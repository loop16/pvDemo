import Link from "next/link";
import Header from "@/components/Header";
export default function AboutPage() {
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
          <div className="label">About</div>
          <h1 className="mono text-2xl font-bold tracking-tight text-neutral-900">About Pricevault</h1>
          <p className="text-[15px] text-neutral-500 leading-relaxed max-w-3xl">
            Pricevault gives discretionary traders institutional-grade probability levels, mid-cycle context, and TradingView overlays without having to build a quant desk. We ingest end-of-day data across global markets, recompute quarter models nightly, and surface the zones that matter every morning.
          </p>
        </section>

        <div className="mt-16 border-t border-neutral-200 pt-12 grid grid-cols-1 md:grid-cols-2 gap-0">
          <article className="card border-r-0 md:border-r md:border-r-neutral-200 space-y-3">
            <h2 className="mono text-[15px] font-semibold">What&apos;s inside</h2>
            <ul className="space-y-2 text-sm text-neutral-600">
              <li className="flex items-start gap-2"><span className="mono text-neutral-400 mt-0.5 text-xs select-none">&mdash;</span><span><strong className="text-neutral-900">Quarter models</strong> &mdash; simple + pro scenarios refreshed at every EOD close.</span></li>
              <li className="flex items-start gap-2"><span className="mono text-neutral-400 mt-0.5 text-xs select-none">&mdash;</span><span><strong className="text-neutral-900">Full instrument library</strong> &mdash; equities, futures, FX, and crypto back to 1960 where available.</span></li>
              <li className="flex items-start gap-2"><span className="mono text-neutral-400 mt-0.5 text-xs select-none">&mdash;</span><span><strong className="text-neutral-900">Indicators package</strong> &mdash; TradingView overlays for EURUSD, SPX, BTC, ETH, NDX, GC, CL, TNX.</span></li>
              <li className="flex items-start gap-2"><span className="mono text-neutral-400 mt-0.5 text-xs select-none">&mdash;</span><span><strong className="text-neutral-900">Workflow friendly</strong> &mdash; export snapshots, add notes, and share setups with your team.</span></li>
            </ul>
          </article>

          <article className="card space-y-3">
            <h2 className="mono text-[15px] font-semibold">Why we built it</h2>
            <p className="text-sm text-neutral-600 leading-relaxed">
              We ran the same process on prop desks: align the quarter, map the upside/downside, and brief the team before the opening bell. Pricevault packages that workflow so macro desks, hedge funds, and focused independents can ship faster. One shared playbook, zero spreadsheet chaos.
            </p>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Need white-label data, enterprise onboarding, or custom indicators? Let us know&mdash;we support institutional deployments as well.
            </p>
          </article>
        </div>

        <section className="mt-16 border-t border-neutral-200 pt-12 space-y-3">
          <h2 className="mono text-[15px] font-semibold">What we&apos;re not</h2>
          <ul className="space-y-2 text-sm text-neutral-600">
            <li className="flex items-start gap-2"><span className="mono text-red-400 mt-0.5 text-xs select-none">&times;</span><span>We are not a signal room or copy-trading platform.</span></li>
            <li className="flex items-start gap-2"><span className="mono text-red-400 mt-0.5 text-xs select-none">&times;</span><span>We do not redistribute real-time exchange data&mdash;Pricevault operates on delayed/EOD feeds.</span></li>
            <li className="flex items-start gap-2"><span className="mono text-red-400 mt-0.5 text-xs select-none">&times;</span><span>This is not investment advice. We surface probabilities; you execute the plan.</span></li>
          </ul>
        </section>

        <section className="mt-16 border-t border-neutral-200 pt-12 space-y-4">
          <h2 className="mono text-[15px] font-semibold">Analysis Models</h2>
          <p className="text-sm text-neutral-600 leading-relaxed">
            Pricevault offers four distinct models for analyzing price levels, each designed for different use cases and trading styles. Learn more about how each model works and when to use them.
          </p>
        </section>

        <section className="mt-14 flex flex-wrap gap-3">
          <Link
            href="/pricing"
            className="mono border border-neutral-900 bg-neutral-900 text-white px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider hover:opacity-85 transition-opacity"
          >
            Explore pricing
          </Link>
          <Link
            href="/models"
            className="mono border border-neutral-300 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-600 hover:border-neutral-900 hover:text-neutral-900 transition-colors"
          >
            Learn about our models
          </Link>
        </section>

        <section className="mt-16 border-t border-neutral-200 pt-12 space-y-4">
          <h2 className="mono text-[15px] font-semibold">Disclaimers</h2>
          <div className="space-y-3 text-sm text-neutral-500 leading-relaxed">
            <p><strong className="text-neutral-700">Education Only / No Advice.</strong> Pricevault is for educational and informational purposes only. Nothing on this site is investment, tax, accounting, or legal advice, and nothing is a recommendation or solicitation to buy or sell any security, futures contract, option, cryptocurrency, or instrument.</p>
            <p><strong className="text-neutral-700">No Registration / Independence.</strong> Pricevault is not a broker-dealer, investment adviser, commodity trading advisor (CTA), or commodity pool operator (CPO), and does not accept customer funds or provide trade execution.</p>
            <p><strong className="text-neutral-700">Risk Disclosure.</strong> Trading involves substantial risk of loss and is not suitable for all investors. Futures, options, and leveraged products involve significant risk and may result in losses greater than your initial investment. Only risk capital should be used.</p>
            <p><strong className="text-neutral-700">U.S. Government Required Disclaimer.</strong> Futures and options trading has large potential rewards, but also large potential risk. Do not trade with money you cannot afford to lose. No representation is being made that any account will or is likely to achieve profits or losses similar to those discussed. Past performance is not indicative of future results.</p>
            <p><strong className="text-neutral-700">CFTC Rule 4.41 &ndash; Hypothetical/Simulated Performance.</strong> Hypothetical or simulated performance results have inherent limitations. Since the trades have not been executed, results may differ materially from live trading. Simulated trading programs are designed with the benefit of hindsight and do not capture liquidity, slippage, or psychological factors. No representation is being made that any account will or is likely to achieve profits or losses similar to those shown.</p>
            <p><strong className="text-neutral-700">Backtests, Models, and Patterns.</strong> Any backtested results, model outputs, or pattern detections reflect assumptions and are provided for research illustration. Methodologies, parameters, and datasets may change without notice. Results may differ materially when applied in live markets.</p>
            <p><strong className="text-neutral-700">Data Accuracy &amp; Availability.</strong> Data is provided &quot;as is&quot; and &quot;as available.&quot; It may be delayed, incomplete, inaccurate, or unavailable from time to time. Pricevault and its data providers do not guarantee the accuracy, timeliness, or completeness of any data and are not liable for errors, omissions, or interruptions.</p>
            <p><strong className="text-neutral-700">Market-Data Licensing.</strong> Market data and content are the property of their respective owners and/or exchanges. Redistribution, reproduction, or display beyond this site is prohibited without permission. If an instrument is shown with delayed data, the delay may vary by exchange and product.</p>
            <p><strong className="text-neutral-700">No Reliance / User Responsibility.</strong> You are solely responsible for evaluating the information on this site and for any trading decisions. Always conduct your own research and consult a licensed professional where appropriate.</p>
            <p><strong className="text-neutral-700">Affiliations &amp; Conflicts.</strong> Some pages may reference partners or contain affiliate links. We may receive compensation if you click or transact, which may create a conflict of interest. We do not accept compensation to promote specific trades or instruments.</p>
            <p><strong className="text-neutral-700">Testimonials.</strong> Any testimonials or reviews may not be representative of other clients and are not a guarantee of future performance or success.</p>
            <p><strong className="text-neutral-700">Limitation of Liability.</strong> To the fullest extent permitted by law, Pricevault, its owners, and affiliates disclaim any liability for direct, indirect, incidental, consequential, or special damages arising out of or in connection with the use of the site, data, models, or content.</p>
          </div>
        </section>
      </main>
    </>
  );
}
