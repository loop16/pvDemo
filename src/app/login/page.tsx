"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginInner() {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/app";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const r = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (r.ok) router.push(next);
    else setErr("Invalid access code");
  }

  return (
    <main className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-6">
      <form onSubmit={submit} className="w-full rounded-2xl border p-6 shadow-[0_8px_18px_rgba(0,0,0,0.06)]">
        <h1 className="text-2xl font-semibold">Enter Access Code</h1>
        <p className="mt-2 text-sm text-neutral-600">Use <code>demo</code> (change via DEMO_ACCESS_CODE).</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Access code"
          className="mt-4 w-full rounded-xl border px-3 py-2"
        />
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        <button type="submit" className="mt-4 w-full rounded-xl bg-black px-4 py-2 text-white hover:opacity-90">
          Continue
        </button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

