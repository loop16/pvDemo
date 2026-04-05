import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function TermsPage() {
    return (
        <>
            <Header />
            <main className="relative z-20 max-w-2xl mx-auto px-6 py-20">
                <div
                    style={{
                        background: "rgba(255,255,255,0.7)",
                        backdropFilter: "blur(20px)",
                        WebkitBackdropFilter: "blur(20px)",
                        borderRadius: "16px",
                        border: "1px solid rgba(255,255,255,0.6)",
                        padding: "48px",
                    }}
                >
                    <p className="label mb-3">Legal</p>
                    <h1 className="mono text-2xl font-bold mb-2">Terms of Service</h1>
                    <p className="text-sm text-neutral-400 mb-10">Last updated: April 2, 2026</p>

                    <div className="space-y-8 text-sm text-neutral-700 leading-relaxed">
                        <section>
                            <h2 className="mono font-semibold text-neutral-900 mb-2 uppercase text-xs tracking-wider">1. Acceptance</h2>
                            <p>By accessing or using Pricevault ("the Service"), you agree to be bound by these Terms. If you do not agree, do not use the Service.</p>
                        </section>

                        <section>
                            <h2 className="mono font-semibold text-neutral-900 mb-2 uppercase text-xs tracking-wider">2. Description of Service</h2>
                            <p>Pricevault provides market data analysis tools, including quarterly price range analysis and market movers data, for informational purposes only. Nothing on the Service constitutes financial advice, investment advice, or a recommendation to buy or sell any security or instrument.</p>
                        </section>

                        <section>
                            <h2 className="mono font-semibold text-neutral-900 mb-2 uppercase text-xs tracking-wider">3. Subscriptions & Billing</h2>
                            <p>Paid plans are billed on a recurring basis. You may cancel at any time through your account portal. Cancellation takes effect at the end of the current billing period. No refunds are issued for partial periods. We reserve the right to change pricing with 30 days notice.</p>
                        </section>

                        <section>
                            <h2 className="mono font-semibold text-neutral-900 mb-2 uppercase text-xs tracking-wider">4. Acceptable Use</h2>
                            <p>You may not resell, redistribute, scrape, or use the Service's data or outputs in any commercial product without explicit written permission. You may not attempt to circumvent subscription restrictions or access controls.</p>
                        </section>

                        <section>
                            <h2 className="mono font-semibold text-neutral-900 mb-2 uppercase text-xs tracking-wider">5. Disclaimer of Warranties</h2>
                            <p>The Service is provided "as is" without warranty of any kind. Market data may be delayed, inaccurate, or unavailable. We make no guarantees about uptime, data accuracy, or fitness for any particular purpose. Trading financial instruments involves significant risk of loss.</p>
                        </section>

                        <section>
                            <h2 className="mono font-semibold text-neutral-900 mb-2 uppercase text-xs tracking-wider">6. Limitation of Liability</h2>
                            <p>To the maximum extent permitted by law, Pricevault shall not be liable for any indirect, incidental, special, or consequential damages, including but not limited to trading losses, arising from use of the Service.</p>
                        </section>

                        <section>
                            <h2 className="mono font-semibold text-neutral-900 mb-2 uppercase text-xs tracking-wider">7. Termination</h2>
                            <p>We reserve the right to suspend or terminate accounts that violate these Terms. You may terminate your account at any time by cancelling your subscription and ceasing use of the Service.</p>
                        </section>

                        <section>
                            <h2 className="mono font-semibold text-neutral-900 mb-2 uppercase text-xs tracking-wider">8. Changes</h2>
                            <p>We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance. Material changes will be communicated by email.</p>
                        </section>

                        <section>
                            <h2 className="mono font-semibold text-neutral-900 mb-2 uppercase text-xs tracking-wider">9. Contact</h2>
                            <p>Questions? Email us at <a href="mailto:support@price-vault.com" className="underline">support@price-vault.com</a>.</p>
                        </section>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
