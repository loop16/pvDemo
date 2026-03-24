"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

export default function AppHeader() {
  const handleLogout = () => {
    signOut({ callbackUrl: "/" });
  };

  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200">
      <Link href="/" className="flex items-center gap-2">
        <img src="/logo.svg" alt="Pricevault" width="22" height="22" />
        <span className="mono text-[14px] font-semibold tracking-tight">Pricevault</span>
      </Link>
      <nav className="flex items-center gap-1">
        <Link
          href="/account"
          className="mono px-3 py-1.5 text-[11px] text-neutral-500 hover:text-neutral-900 transition-colors uppercase tracking-wider"
        >
          Manage
        </Link>
        <Link
          href="/about"
          className="mono px-3 py-1.5 text-[11px] text-neutral-500 hover:text-neutral-900 transition-colors uppercase tracking-wider"
        >
          About
        </Link>
        <button
          onClick={handleLogout}
          className="mono ml-2 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase text-neutral-500 border border-neutral-200 hover:text-red-600 hover:border-red-300 transition-colors"
        >
          Logout
        </button>
      </nav>
    </div>
  );
}
