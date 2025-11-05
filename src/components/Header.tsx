import Link from "next/link";

export default function Header() {
  return (
    <header className="container-hero flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2">
        <img src="/logo.svg" alt="Namedly" width={28} height={28} />
        <span className="text-[18px] font-semibold tracking-tightest">Pricevault</span>
      </Link>
      <nav className="flex items-center gap-3">
        <Link
          href="/about"
          className="rounded-pill border border-neutral-300 px-4 py-2 text-[14px] hover:bg-neutral-50"
        >
          About
        </Link>
        <Link
          href="/signup"
          className="rounded-pill bg-black px-4 py-2 text-[14px] font-medium text-white hover:opacity-90"
        >
          Login
        </Link>
      </nav>
    </header>
  );
}
