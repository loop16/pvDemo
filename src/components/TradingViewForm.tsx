"use client";

import { useState } from "react";

type Props = {
  initialValue?: string | null;
  planLabel: string;
};

export default function TradingViewForm({ initialValue, planLabel }: Props) {
  const [value, setValue] = useState(initialValue ?? "");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/account/tradingview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Unable to save TradingView username.");
      }
      setStatus("success");
      setMessage("Saved.");
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message || "Unable to save TradingView username.");
    } finally {
      setTimeout(() => setStatus("idle"), 1500);
    }
  };

  return (
    <div className="mt-6 border border-neutral-200 p-5" style={{ background: 'rgba(255,255,255,0.4)' }}>
      <div className="label mb-1">TradingView</div>
      <p className="text-sm font-semibold text-neutral-900 mono">Connect your account</p>
      <p className="mt-1 text-xs text-neutral-500">
        Required for the {planLabel} plan. Enter your TradingView username so we can enable indicator access.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="TradingView username"
          className="symbol-input w-full md:flex-1"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="mono bg-neutral-900 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-white hover:opacity-85 transition-opacity disabled:opacity-50"
        >
          {status === "loading" ? "Saving..." : "Save"}
        </button>
      </form>

      {status === "error" && (
        <p className="mt-2 text-xs text-red-600 mono">{message}</p>
      )}
      {status === "success" && (
        <p className="mt-2 text-xs text-emerald-600 mono">{message}</p>
      )}
    </div>
  );
}
