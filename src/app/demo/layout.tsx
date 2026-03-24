"use client";
import Link from "next/link";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200">
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo.svg" alt="Pricevault" width={22} height={22} />
          <span className="mono text-[14px] font-semibold tracking-tight">Pricevault</span>
          <span className="mono ml-1 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-neutral-400 border border-neutral-200">
            Demo
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link href="/about" className="mono px-3 py-1.5 text-[11px] text-neutral-500 hover:text-neutral-900 transition-colors uppercase tracking-wider">
            About
          </Link>
          <Link
            href="/login"
            className="mono ml-2 border border-neutral-900 bg-neutral-900 text-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider hover:opacity-85 transition-opacity"
          >
            Sign up
          </Link>
        </nav>
      </div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
