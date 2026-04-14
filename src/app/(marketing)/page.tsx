import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import BrowserCard from "@/components/BrowserCard";

export const metadata: Metadata = {
  title: "Pricevault — Stop Levels That Matter",
  description:
    "Statistically-derived stop levels across 1,200+ assets. Quarterly probability zones for stocks, futures, crypto, and FX. Your exit should be backed by data, not a feeling.",
  alternates: { canonical: "https://price-vault.com" },
};

export default function Home() {
  return (
    <div
      className="relative"
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        touchAction: 'manipulation',
        overscrollBehavior: 'none',
      }}
    >
      {/* Content */}
      <div className="relative z-20 h-full flex flex-col">
        <Header />

        <section className="w-full max-w-[1280px] mx-auto pl-6 pr-14 sm:px-6 mt-[2vh] md:mt-8 grid grid-cols-1 items-start gap-6 md:gap-0 pt-0 pb-0 md:pb-12 md:grid-cols-[640px_minmax(0,1fr)] flex-1 min-h-0">
          <div className="max-w-[320px] sm:max-w-[640px] md:w-[640px] md:max-w-[640px]">
            <h1 className="serif max-w-[320px] sm:max-w-none text-[46px] sm:text-[62px] md:text-[76px] md:whitespace-nowrap leading-[1.06] text-neutral-900">
              Stop Levels that <span style={{ color: '#003087' }}><em>Matter</em></span>
            </h1>

            <p className="mt-5 sm:mt-7 max-w-[280px] sm:max-w-[520px] md:max-w-[600px] text-[16px] sm:text-[18px] leading-[1.7] text-neutral-500">
              Statistically-derived stop levels across 1,200+ assets.<br />
              Your exit should be backed by data, not a feeling.
            </p>

            <div className="mt-8 sm:mt-12 flex items-center gap-4">
              <Link
                href="/demo"
                className="text-[16px] font-medium text-white bg-neutral-900 border border-neutral-900 w-[148px] py-3.5 text-center hover:opacity-85 transition-opacity"
              >
                See Demo
              </Link>
              <Link
                href="/pricing"
                className="text-[16px] font-medium text-neutral-500 border border-neutral-200 bg-white w-[148px] py-3.5 text-center hover:border-neutral-400 hover:text-neutral-700 transition-all"
              >
                Pricing
              </Link>
            </div>
          </div>

          <div className="hidden md:flex md:items-start md:justify-center md:pt-2">
            <div className="w-full max-w-[592px]">
              <BrowserCard />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
