"use client";
import { usePathname } from "next/navigation";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Apply zoom to landing, pricing, and signup pages, but NOT to models and about
  const shouldZoom = pathname === "/" || pathname === "/pricing" || pathname === "/signup";
  return <div className={shouldZoom ? "landing-zoom" : "marketing-no-zoom"}>{children}</div>;
}









