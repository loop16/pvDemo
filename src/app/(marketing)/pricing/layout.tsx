import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Pricevault gives you full access to quarterly stop levels and probability zones across 1,200+ assets for $25/month. No contracts, cancel any time.",
  alternates: { canonical: "https://price-vault.com/pricing" },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
