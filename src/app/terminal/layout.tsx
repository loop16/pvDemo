"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { SessionProvider, useSession, signOut } from "next-auth/react";
import { ThemeProvider, useTheme } from "@/components/terminal/ThemeContext";
import SettingsPanel from "@/components/terminal/SettingsPanel";
import HalftoneCanvas from "@/components/HalftoneCanvasV1";
import OnboardingPopup from "@/components/terminal/OnboardingPopup";

const NAV_ITEMS = [
  { href: "/terminal", label: "CHARTS" },
  { href: "/terminal/movers", label: "STATS" },
];

function TerminalLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { theme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const onboardingKey = `pv-onboarding-terminal${session?.user?.email ? `-${session.user.email}` : ''}`;
  // Detect dark themes for logo inversion
  const isDark = theme.bg.startsWith('#0') || theme.bg.startsWith('#1') || theme.bg.startsWith('#2') || theme.bg === '#000000';

  useEffect(() => {
    // Warm the movers cache so the Stats page loads instantly
    fetch('/api/movers?model=pro', { priority: 'low' } as RequestInit).catch(() => {});
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      htmlHeight: html.style.height,
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
      bodyHeight: body.style.height,
      bodyTouchAction: body.style.touchAction,
    };

    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    html.style.height = "100%";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    body.style.height = "100%";
    body.style.touchAction = "manipulation";

    return () => {
      html.style.overflow = prev.htmlOverflow;
      html.style.overscrollBehavior = prev.htmlOverscroll;
      html.style.height = prev.htmlHeight;
      body.style.overflow = prev.bodyOverflow;
      body.style.overscrollBehavior = prev.bodyOverscroll;
      body.style.height = prev.bodyHeight;
      body.style.touchAction = prev.bodyTouchAction;
    };
  }, []);

  if (status === "loading") {
    return (
      <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.bg, fontFamily: "'SF Mono', monospace" }}>
        <span style={{ fontSize: 12, color: theme.textDim }}>Loading...</span>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col relative overflow-hidden fixed inset-0"
      style={{
        height: "100dvh",
        background: theme.bg,
        overscrollBehavior: 'none',
        fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace",
      }}
    >
      {/* Halftone background — blurred, normal + rotated 180° for top density */}
      {theme.frosted && (<>
        <div className="fixed inset-0 pointer-events-none" style={{
          zIndex: 0,
          filter: 'blur(18px)',
          opacity: 0.16,
        }}>
          <HalftoneCanvas />
        </div>
        <div className="fixed inset-0 pointer-events-none" style={{
          zIndex: 0,
          filter: 'blur(18px)',
          opacity: 0.13,
          transform: 'rotate(180deg)',
        }}>
          <HalftoneCanvas />
        </div>
      </>)}

      {/* Top bar — 44px */}
      <header
        className="flex items-center justify-between shrink-0 relative z-10"
        style={{
          height: 44,
          padding: "0 20px",
          borderBottom: theme.frosted ? '1px solid rgba(200,200,210,0.3)' : `1px solid ${theme.border}`,
          background: theme.frosted ? 'rgba(255,255,255,0.4)' : theme.surface,
        }}
      >
        {/* Left: Pricevault branding */}
        <Link
          href="/"
          className="flex items-center gap-2"
          style={{ textDecoration: "none", flex: 1 }}
        >
          <Image
            src="/logo.svg"
            alt="Pricevault"
            width={18}
            height={18}
            priority
            style={{
              opacity: 0.9,
              filter: isDark ? 'invert(1) brightness(2)' : 'none',
            }}
          />
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: theme.text,
              fontFamily: "'Instrument Serif', 'Georgia', serif",
            }}
          >
            Pricevault
          </span>
        </Link>

        {/* Center: Navigation links */}
        <nav className="flex items-center" style={{ gap: 2 }}>
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/terminal"
                ? pathname === "/terminal"
                : pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  padding: "6px 14px",
                  color: isActive ? theme.text : theme.textDim,
                  background: isActive ? theme.activeNavBg : "transparent",
                  textDecoration: "none",
                  fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace",
                  transition: "color 0.15s, background 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = theme.textSecondary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = theme.textDim;
                  }
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: Account + Settings */}
        <div className="flex items-center gap-1" style={{ flex: 1, justifyContent: "flex-end" }}>
          <button
            onClick={() => setHelpOpen(true)}
            title="Help"
            style={{
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: theme.textDim,
              cursor: "pointer",
              background: "none",
              border: "none",
              padding: 0,
              borderRadius: 4,
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = theme.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = theme.textDim; }}
          >
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <circle cx={12} cy={12} r={10} />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1={12} y1={17} x2={12.01} y2={17} />
            </svg>
          </button>
          <Link
            href="/account"
            title="Account"
            style={{
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: theme.textDim,
              borderRadius: 4,
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = theme.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = theme.textDim; }}
          >
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx={12} cy={7} r={4} />
            </svg>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            title="Sign out"
            style={{
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: theme.textDim,
              cursor: "pointer",
              background: "none",
              border: "none",
              padding: 0,
              borderRadius: 4,
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = theme.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = theme.textDim; }}
          >
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1={21} y1={12} x2={9} y2={12} />
            </svg>
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            style={{
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: theme.textDim,
              cursor: "pointer",
              background: "none",
              border: "none",
              padding: 0,
              borderRadius: 4,
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = theme.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = theme.textDim; }}
          >
            <svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx={12} cy={12} r={3} />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>


      {/* Content area fills remaining viewport height */}
      <div className="flex-1 overflow-hidden relative z-10" style={{ minHeight: 0 }}>
        {children}
      </div>

      {/* Settings panel */}
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <OnboardingPopup storageKey={onboardingKey} forceOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <TerminalLayoutInner>{children}</TerminalLayoutInner>
      </ThemeProvider>
    </SessionProvider>
  );
}
