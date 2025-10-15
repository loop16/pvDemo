"use client";
import Link from "next/link";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const handleLogout = () => {
    document.cookie = "auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    window.location.href = "/";
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo.svg" alt="Namedly" width="28" height="28"/>
          <span className="text-lg font-semibold">Pricevault</span>
        </Link>
        <nav className="flex items-center gap-3">
          <Link href="/about" className="rounded-full px-4 py-2 text-sm hover:bg-neutral-50">About</Link>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-black text-white text-xs font-semibold hover:bg-gray-800 flex items-center justify-center"
          >
            Logout
          </button>
        </nav>
      </div>
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

