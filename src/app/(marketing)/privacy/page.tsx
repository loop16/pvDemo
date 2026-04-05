import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function PrivacyPage() {
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
                    <h1 className="mono text-2xl font-bold mb-2">Privacy Policy</h1>
                    <p className="text-sm text-neutral-400 mb-10">Last updated: April 2, 2026</p>

                    <div className="space-y-8 text-sm text-neutral-700 leading-relaxed">
                        <section>
                            <h2 className="mono font-semibold text-neutral-900 mb-2 uppercase text-xs tracking-wider">1. What We Collect</h2>
                            <p>We collect the following information when you use Pricevault:</p>
                            <ul className="mt-2 space-y-1 list-disc list-inside text-neutral-600">
                                <li>Email address and name (when you create an account)</li>
                                <li>Billing information processed by Stripe (we do not store card details)</li>
                                <li>TradingView username (if provided in account settings)</li>
                                <li>Basic usage data (page visits, API requests) via Vercel</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="mono font-semibold text-neutral-900 mb-2 uppercase text-xs tracking-wider">2. How We Use It</h2>
                            <p>We use your information to:</p>
                            <ul className="mt-2 space-y-1 list-disc list-inside text-neutral-600">
                                <li>Provide and maintain the Service</li>
                                <li>Process payments and manage your subscription</li>
                                <li>Send transactional emails (receipts, password resets, account notices)</li>
                                <li>Respond to support requests</li>
                            </ul>
                            <p className="mt-2">We do not sell your data to third parties or use it for advertising.</p>
                        </section>

                        <section>
                            <h2 className="mono font-semibold text-neutral-900 mb-2 uppercase text-xs tracking-wider">3. Third-Party Services</h2>
                            <p>We use the following sub-processors:</p>
                            <ul className="mt-2 space-y-1 list-disc list-inside text-neutral-600">
                                <li><strong>Stripe</strong> — payment processing</li>
                                <li><strong>MongoDB Atlas</strong> — account data storage</li>
                                <li><strong>Vercel</strong> — hosting and infrastructure</li>
                                <li><strong>Mailjet</strong> — transactional email delivery</li>
                                <li><strong>Google</strong> — optional OAuth sign-in</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="mono font-semibold text-neutral-900 mb-2 uppercase text-xs tracking-wider">4. Data Retention</h2>
                            <p>We retain your account data for as long as your account is active. If you cancel and request deletion, we will remove your personal data within 30 days. Billing records may be retained longer as required by law.</p>
                        </section>

                        <section>
                            <h2 className="mono font-semibold text-neutral-900 mb-2 uppercase text-xs tracking-wider">5. Cookies</h2>
                            <p>We use session cookies for authentication only. We do not use advertising or tracking cookies. No cookie consent banner is required as we do not track users across sites.</p>
                        </section>

                        <section>
                            <h2 className="mono font-semibold text-neutral-900 mb-2 uppercase text-xs tracking-wider">6. Your Rights</h2>
                            <p>You may request access to, correction of, or deletion of your personal data at any time by emailing <a href="mailto:support@price-vault.com" className="underline">support@price-vault.com</a>. If you are in the EU or UK, you have additional rights under GDPR/UK GDPR.</p>
                        </section>

                        <section>
                            <h2 className="mono font-semibold text-neutral-900 mb-2 uppercase text-xs tracking-wider">7. Security</h2>
                            <p>Passwords are hashed with bcrypt. All data is transmitted over HTTPS. We do not store payment card details — all billing is handled by Stripe.</p>
                        </section>

                        <section>
                            <h2 className="mono font-semibold text-neutral-900 mb-2 uppercase text-xs tracking-wider">8. Contact</h2>
                            <p>Privacy questions: <a href="mailto:support@price-vault.com" className="underline">support@price-vault.com</a></p>
                        </section>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    );
}
