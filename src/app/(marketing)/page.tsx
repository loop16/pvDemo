import Link from "next/link";
import Header from "@/components/Header";
import BrowserCard from "@/components/BrowserCard";

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
          <div className="max-w-[300px] sm:max-w-[640px] md:w-[640px] md:max-w-[640px]">
            <h1 className="serif max-w-[300px] sm:max-w-none text-[36px] sm:text-[48px] md:text-[60px] md:whitespace-nowrap leading-[1.08] text-neutral-900">
              Stop Levels that <span style={{ color: '#003087' }}><em>Matter</em></span>
            </h1>

            <p className="mt-4 sm:mt-6 max-w-[252px] sm:max-w-[500px] md:max-w-[600px] text-[14px] sm:text-[16px] leading-[1.7] text-neutral-500">
              Statistically-derived stop levels across 1,200+ assets.<br />
              Your exit should be backed by data, not a feeling.
            </p>

            <div className="mt-6 sm:mt-10 flex items-center gap-3">
              <Link
                href="/demo"
                className="text-[15px] font-medium text-white bg-neutral-900 border border-neutral-900 w-[130px] py-3 text-center hover:opacity-85 transition-opacity"
              >
                See Demo
              </Link>
              <Link
                href="/pricing"
                className="text-[15px] font-medium text-neutral-500 border border-neutral-200 bg-white w-[130px] py-3 text-center hover:border-neutral-400 hover:text-neutral-700 transition-all"
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
