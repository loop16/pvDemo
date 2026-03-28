"use client";

import { useState } from "react";
import Link from "next/link";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="relative z-20">
      <div className="max-w-[1280px] mx-auto px-6 flex items-center justify-between relative z-50" style={{ paddingTop: '20px', paddingBottom: '20px' }}>
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
          className="md:hidden flex items-center justify-center w-10 h-10"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu"
        >
          {menuOpen ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#262626" strokeWidth="1.9" strokeLinecap="round">
              <path d="M6 6L18 18" />
              <path d="M18 6L6 18" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#262626" strokeWidth="1.9" strokeLinecap="round">
              <path d="M4 7H20" />
              <path d="M4 12H20" />
              <path d="M4 17H20" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown — liquid glass, covers below header leaving just headline visible */}
      {menuOpen && (
        <div
          className="md:hidden fixed left-0 right-0 z-40"
          style={{
            top: 0,
            bottom: 0,
            paddingTop: 70,
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(20px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
            borderBottom: '1px solid rgba(255,255,255,0.6)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div className="px-6 py-6 flex flex-col gap-5">
            <Link href="/about" className="text-[16px] text-neutral-700 font-medium" onClick={() => setMenuOpen(false)}>About</Link>
            <Link href="/models" className="text-[16px] text-neutral-700 font-medium" onClick={() => setMenuOpen(false)}>Models</Link>
            <Link href="/pricing" className="text-[16px] text-neutral-700 font-medium" onClick={() => setMenuOpen(false)}>Pricing</Link>
            <div className="flex gap-3 pt-4">
              <Link href="/demo" className="text-[14px] font-medium text-neutral-900 bg-white/80 border border-neutral-300 px-5 py-3 flex-1 text-center" onClick={() => setMenuOpen(false)}>Try Demo</Link>
              <Link href="/login" className="text-[14px] font-medium text-white bg-neutral-900 border border-neutral-900 px-5 py-3 flex-1 text-center" onClick={() => setMenuOpen(false)}>Login</Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
