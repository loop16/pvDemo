import Link from "next/link";
import Header from "@/components/Header";
import BrowserCard from "@/components/BrowserCard";

export default function Home() {
  return (
    <>
      <Header />

      <div aria-hidden className="h-6 md:h-8 lg:h-10" />

      <section
        id="hero"
        className="container-hero mt-[7.5vh] md:mt-[10vh] grid grid-cols-1 items-start gap-10 pt-0 pb-8 md:grid-cols-12 md:gap-12"
      >
        {/* Left copy */}
        <div className="md:col-span-6 max-w-[640px]">
          <h1 className="text-[44px] md:text-[58px] leading-[1.04] font-extrabold tracking-tightest">
            Institutional Grade
            <br /> Pricing Models for
            <br /> <span className="text-brand">Everyone</span>
          </h1>

          <p className="mt-5 max-w-[520px] text-[15px] md:text-[16px] leading-[1.68] text-neutral-600">
            Explore historical datasets across 1200+ assets spanning up to 60 years. Stocks, Crypto, FX, and Futures.
          </p>

          <div className="mt-8 flex items-center gap-3">
            <Link href="/demo" className="rounded-pill bg-black px-5 py-3 text-white hover:opacity-90">
              See Demo
            </Link>
            <Link href="/pricing" className="rounded-pill border border-neutral-300 px-5 py-3 hover:bg-neutral-50">
              Pricing
            </Link>
          </div>
        </div>

        {/* Right image card */}
        <div className="md:col-span-6 md:pt-4">
          <BrowserCard />
        </div>
      </section>
    </>
  );
}
