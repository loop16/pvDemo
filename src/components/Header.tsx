import Link from "next/link";

export default function Header() {
  return (
    <header className="relative z-20">
      <div className="max-w-[1280px] mx-auto px-6 flex items-center justify-between" style={{ paddingTop: '35px', paddingBottom: '35px' }}>
      <Link href="/" className="flex items-center gap-2.5">
        <img src="/logo.svg" alt="Pricevault" width={28} height={28} />
        <span className="serif text-[22px] tracking-tight">Pricevault</span>
      </Link>
      <nav className="flex items-center gap-8">
        <Link href="/about" className="text-[15px] text-neutral-400 hover:text-neutral-900 transition-colors">
          About
        </Link>
        <Link href="/models" className="text-[15px] text-neutral-400 hover:text-neutral-900 transition-colors">
          Models
        </Link>
        <Link href="/pricing" className="text-[15px] text-neutral-400 hover:text-neutral-900 transition-colors">
          Pricing
        </Link>
        <Link
          href="/demo"
          className="text-[14px] font-medium text-neutral-900 bg-white border border-neutral-300 px-5 py-2 hover:bg-neutral-50 transition-colors"
        >
          Try Demo
        </Link>
        <Link
          href="/login"
          className="text-[14px] font-medium text-white bg-neutral-900 border border-neutral-900 px-5 py-2 hover:opacity-85 transition-opacity"
        >
          Login
        </Link>
      </nav>
      </div>
    </header>
  );
}
