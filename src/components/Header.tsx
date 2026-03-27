"use client";

import { useState } from "react";
import Link from "next/link";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="relative z-20">
      <div className="max-w-[1280px] mx-auto px-6 flex items-center justify-between" style={{ paddingTop: '20px', paddingBottom: '20px' }}>
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="Pricevault" width={28} height={28} />
          <span className="serif text-[22px] tracking-tight">Pricevault</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          <Link href="/about" className="text-[15px] text-neutral-400 hover:text-neutral-900 transition-colors">About</Link>
          <Link href="/models" className="text-[15px] text-neutral-400 hover:text-neutral-900 transition-colors">Models</Link>
          <Link href="/pricing" className="text-[15px] text-neutral-400 hover:text-neutral-900 transition-colors">Pricing</Link>
          <Link href="/demo" className="text-[14px] font-medium text-neutral-900 bg-white border border-neutral-300 px-5 py-2 hover:bg-neutral-50 transition-colors">Try Demo</Link>
          <Link href="/login" className="text-[14px] font-medium text-white bg-neutral-900 border border-neutral-900 px-5 py-2 hover:opacity-85 transition-opacity">Login</Link>
        </nav>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu"
        >
          <span className={`block w-5 h-0.5 bg-neutral-800 transition-transform ${menuOpen ? 'rotate-45 translate-y-[4px]' : ''}`} />
          <span className={`block w-5 h-0.5 bg-neutral-800 transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-5 h-0.5 bg-neutral-800 transition-transform ${menuOpen ? '-rotate-45 -translate-y-[4px]' : ''}`} />
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-neutral-200 z-50 px-6 py-4 flex flex-col gap-4">
          <Link href="/about" className="text-[15px] text-neutral-600" onClick={() => setMenuOpen(false)}>About</Link>
          <Link href="/models" className="text-[15px] text-neutral-600" onClick={() => setMenuOpen(false)}>Models</Link>
          <Link href="/pricing" className="text-[15px] text-neutral-600" onClick={() => setMenuOpen(false)}>Pricing</Link>
          <div className="flex gap-3 pt-2">
            <Link href="/demo" className="text-[14px] font-medium text-neutral-900 bg-white border border-neutral-300 px-5 py-2.5 flex-1 text-center" onClick={() => setMenuOpen(false)}>Try Demo</Link>
            <Link href="/login" className="text-[14px] font-medium text-white bg-neutral-900 border border-neutral-900 px-5 py-2.5 flex-1 text-center" onClick={() => setMenuOpen(false)}>Login</Link>
          </div>
        </div>
      )}
    </header>
  );
}
