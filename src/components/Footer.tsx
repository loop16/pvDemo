import Link from "next/link";

export default function Footer() {
  return (
    <footer
      className="relative z-10 border-t border-neutral-200 mt-16"
      style={{
        background: "rgba(255,255,255,0.6)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="Pricevault" width={20} height={20} />
          <span className="serif text-[17px] tracking-tight text-neutral-900">Pricevault</span>
        </div>

        {/* Links */}
        <nav className="flex flex-wrap gap-x-8 gap-y-3 text-[13px] text-neutral-500">
          <Link href="/about" className="hover:text-neutral-900 transition-colors">About</Link>
          <Link href="/models" className="hover:text-neutral-900 transition-colors">Models</Link>
          <Link href="/pricing" className="hover:text-neutral-900 transition-colors">Pricing</Link>
          <Link href="/demo" className="hover:text-neutral-900 transition-colors">Demo</Link>
          <Link href="/terms" className="hover:text-neutral-900 transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-neutral-900 transition-colors">Privacy</Link>
          <a href="mailto:support@price-vault.com" className="hover:text-neutral-900 transition-colors">Contact</a>
        </nav>

        {/* Legal */}
        <p className="text-[11px] text-neutral-400 mono">
          © {new Date().getFullYear()} Pricevault. Not financial advice.
        </p>
      </div>
    </footer>
  );
}
