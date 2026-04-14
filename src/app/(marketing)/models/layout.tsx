import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analysis Models",
  description:
    "Understand how Pricevault's Pro, Simple, and Beta models work — quarterly scenario analysis, directional levels, and volatility-adjusted stops for any asset.",
  alternates: { canonical: "https://price-vault.com/models" },
};

export default function ModelsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
