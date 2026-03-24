"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/demo", label: "CHARTS" },
  { href: "/terminal/movers", label: "MOVERS" },
];

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div
      className="flex flex-col"
      style={{
        height: "100dvh",
        background: "#0a0a0a",
        fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace",
      }}
    >
      {/* ── Top bar ── */}
      <header
        className="flex items-center justify-between shrink-0"
        style={{
          height: 48,
          padding: "0 20px",
          borderBottom: "1px solid #1a1a1a",
          background: "#0a0a0a",
        }}
      >
        <Link
          href="/"
          className="flex items-center gap-2"
          style={{ textDecoration: "none" }}
        >
          <img src="/logo.svg" alt="Pricevault" width={18} height={18} style={{ opacity: 0.8 }} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: "#e0e0e0",
            }}
          >
            PRICEVAULT
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.12em",
              color: "#666",
              border: "1px solid #333",
              padding: "2px 6px",
              marginLeft: 4,
            }}
          >
            TERMINAL
          </span>
        </Link>

        <nav className="flex items-center" style={{ gap: 2 }}>
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  padding: "6px 14px",
                  color: isActive ? "#e0e0e0" : "#555",
                  background: isActive ? "#1a1a1a" : "transparent",
                  textDecoration: "none",
                  transition: "color 0.15s, background 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = "#999";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = "#555";
                  }
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* ── Content ── */}
      <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}
