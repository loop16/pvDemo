import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import { Analytics } from "@vercel/analytics/next";

const SITE_URL = "https://price-vault.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Pricevault — Stop Levels That Matter",
    template: "%s | Pricevault",
  },
  description:
    "Statistically-derived stop levels across 1,200+ assets. Quarterly probability zones for stocks, futures, crypto, and FX. Your exit should be backed by data, not a feeling.",
  keywords: [
    "stop loss levels",
    "trading probability zones",
    "quarterly range analysis",
    "market levels",
    "trading tools",
    "price levels",
    "stop levels",
    "futures trading",
    "crypto trading levels",
    "statistical trading",
  ],
  authors: [{ name: "Pricevault" }],
  creator: "Pricevault",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Pricevault",
    title: "Pricevault — Stop Levels That Matter",
    description:
      "Statistically-derived stop levels across 1,200+ assets. Quarterly probability zones for stocks, futures, crypto, and FX.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Pricevault" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricevault — Stop Levels That Matter",
    description:
      "Statistically-derived stop levels across 1,200+ assets. Quarterly probability zones for stocks, futures, crypto, and FX.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  alternates: { canonical: SITE_URL },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`antialiased overflow-x-hidden bg-white text-neutral-900`} style={{ overscrollBehavior: 'none' }}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Pricevault",
              url: SITE_URL,
              applicationCategory: "FinanceApplication",
              description:
                "Statistically-derived stop levels and quarterly probability zones across 1,200+ assets including stocks, futures, crypto, and FX.",
              offers: { "@type": "Offer", price: "25", priceCurrency: "USD", priceSpecification: { "@type": "UnitPriceSpecification", billingDuration: "P1M" } },
              provider: { "@type": "Organization", name: "Pricevault", url: SITE_URL },
            }),
          }}
        />
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
