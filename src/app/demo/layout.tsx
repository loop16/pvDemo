"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider, useTheme } from "@/components/terminal/ThemeContext";
import HalftoneCanvas from "@/components/HalftoneCanvasV1";
import SettingsPanel from "@/components/terminal/SettingsPanel";
import OnboardingPopup from "@/components/terminal/OnboardingPopup";

function DemoLayoutInner({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isDark = theme.bg.startsWith('#0') || theme.bg.startsWith('#1') || theme.bg.startsWith('#2') || theme.bg === '#000000';

  return (
    <div className="flex flex-col relative overflow-hidden" style={{ height: '100dvh', background: theme.bg }}>
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0, filter: 'blur(12px)', opacity: 0.3 }}>
        <HalftoneCanvas />
      </div>
      <header
        className="flex items-center justify-between shrink-0 relative z-10"
        style={{ height: 44, padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(30px) saturate(1.6)', WebkitBackdropFilter: 'blur(30px) saturate(1.6)' }}
      >
        <Link href="/" className="flex items-center gap-2" style={{ textDecoration: 'none' }}>
          <Image
            src="/logo.svg"
            alt="Pricevault"
            width={18}
            height={18}
            priority
            style={{ opacity: 0.9, filter: isDark ? 'invert(1) brightness(2)' : 'none' }}
          />
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text, fontFamily: "'Instrument Serif', 'Georgia', serif" }}>
            Pricevault
          </span>
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', color: theme.textDim, border: `1px solid ${theme.border}`, padding: '2px 6px', marginLeft: 4, fontFamily: "'SF Mono', monospace", textTransform: 'uppercase' }}>
            Demo
          </span>
        </Link>

        <nav className="flex items-center" style={{ gap: 2 }}>
          <Link
            href="/login"
            style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', padding: '6px 14px', color: theme.text, background: theme.activeNavBg, textDecoration: 'none', fontFamily: "'SF Mono', monospace" }}
          >
            SIGN UP
          </Link>
        </nav>

        <button
          onClick={() => setSettingsOpen(true)}
          style={{ color: theme.textDim, cursor: 'pointer', background: 'none', border: 'none', padding: 4 }}
          title="Settings"
        >
          <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.3}>
            <circle cx={8} cy={8} r={2.5} /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.9 2.9l1.4 1.4M11.7 11.7l1.4 1.4M2.9 13.1l1.4-1.4M11.7 4.3l1.4-1.4" />
          </svg>
        </button>
      </header>

      <div className="flex-1 overflow-hidden relative z-10" style={{ minHeight: 0 }}>
        {children}
      </div>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <OnboardingPopup storageKey="pv-onboarding-demo" alwaysShow variant="demo" />
    </div>
  );
}

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ThemeProvider>
        <DemoLayoutInner>{children}</DemoLayoutInner>
      </ThemeProvider>
      <Analytics />
    </>
  );
}
