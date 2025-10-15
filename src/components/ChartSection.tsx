"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const ChartClient = dynamic(() => import("@/components/ChartClient"), { ssr: false });

type CatalogItem = { id: string; label: string };

export default function ChartSection() {
  const [symbols, setSymbols] = useState<CatalogItem[]>([]);
  const [symbol, setSymbol] = useState("ES");

  useEffect(() => {
    fetch("/catalog.json").then(r => r.json()).then((data) => setSymbols(data));
  }, []);

  return (
    <section className="mt-10 space-y-4">
      <select
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
        className="rounded-xl border px-3 py-2"
      >
        {symbols.map(s => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
      <ChartClient symbol={symbol} />
    </section>
  );
}

