"use client";

import { useEffect } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import BrowserCard from "@/components/BrowserCard";
export default function Home() {
  // Lock body scroll on iOS
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, []);
  return (
    <div className="h-[100dvh] overflow-hidden relative">
      {/* Content */}
      <div className="relative z-20">
        <Header />

        <section className="max-w-[1280px] mx-auto px-6 mt-[2vh] md:mt-[6vh] grid grid-cols-1 items-start gap-6 md:gap-12 pt-0 pb-0 md:pb-12 md:grid-cols-12">
          <div className="md:col-span-6 max-w-[640px]">
            <h1 className="serif text-[36px] sm:text-[48px] md:text-[62px] leading-[1.08] text-neutral-900">
              Stop Levels that <span style={{ color: '#003087' }}><em>Matter</em></span>
            </h1>

            <p className="mt-4 sm:mt-6 max-w-[500px] text-[14px] sm:text-[16px] leading-[1.7] text-neutral-500">
              Place your stop in historically meaningful areas. 1,200+ assets across stocks, crypto, FX, and futures. Quarter models recomputed nightly. Probability levels surfaced every morning.
            </p>

            <div className="mt-6 sm:mt-10 flex items-center gap-3">
              <Link
                href="/demo"
                className="text-[15px] font-medium text-white bg-neutral-900 border border-neutral-900 px-7 py-3 hover:opacity-85 transition-opacity"
              >
                See Demo
              </Link>
              <Link
                href="/pricing"
                className="text-[15px] font-medium text-neutral-500 border border-neutral-200 bg-white px-7 py-3 hover:border-neutral-400 hover:text-neutral-700 transition-all"
              >
                Pricing
              </Link>
            </div>
          </div>

          <div className="hidden md:block md:col-span-6 md:pt-2">
            <BrowserCard />
          </div>
        </section>
      </div>
    </div>
  );
}
