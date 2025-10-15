"use client";

import { FormEvent, useState } from "react";
import Header from "@/components/Header";

type Status = "idle" | "loading" | "success" | "error";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  const isLoading = status === "loading";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = email.trim();

    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus("error");
      setMessage("Enter a valid email address to continue.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Unable to save your request.");
      }

      setStatus("success");
      setMessage(data?.message || "Thanks! We'll email you when we launch.");
      setEmail("");
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message ?? "Something went wrong. Please try again.");
    }
  };

  return (
    <>
      <Header />

      <div aria-hidden className="h-6 md:h-10" />

      <main className="container-hero max-w-3xl">
        <section className="card">
          <h1 className="card-title text-[24px] md:text-[28px]">Be first to know</h1>
          <p className="text-sm md:text-base text-neutral-600 leading-relaxed">
            Drop your email below and we&apos;ll let you know as soon as the full Pricevault platform is ready. No spam,
            just launch updates.
          </p>

          <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 text-sm font-medium text-neutral-700">
              Email address
              <input
                type="email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="symbol-input w-full md:w-auto"
                placeholder="you@example.com"
                autoComplete="email"
                required
                disabled={isLoading}
              />
            </label>

            <button
              type="submit"
              className="btn-primary btn-notify self-start"
              disabled={isLoading}
            >
              {isLoading ? "Sending..." : "Notify me"}
            </button>
          </form>

          {message && (
            <div
              className={`mt-4 text-sm ${
                status === "success" ? "green" : "red"
              }`}
            >
              {message}
            </div>
          )}

          <p className="mt-6 text-xs text-neutral-500">
            We use your email solely to share product updates. You can opt out anytime.
          </p>
        </section>
      </main>
    </>
  );
}
