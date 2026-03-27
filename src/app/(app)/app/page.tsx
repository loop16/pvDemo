"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AppPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/terminal");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <span className="text-sm text-neutral-400 animate-pulse">Redirecting to terminal...</span>
    </div>
  );
}
