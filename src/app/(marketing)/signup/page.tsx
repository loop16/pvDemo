"use client";

import { useState, useEffect } from "react";
import { signIn, getProviders } from "next-auth/react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [hasGoogle, setHasGoogle] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Unable to create account.");
      }

      const signInRes = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (signInRes?.error) {
        throw new Error("Account created, but sign-in failed. Please log in.");
      }

      router.refresh();
      router.push("/post-login");
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err?.message || "Something went wrong.");
    } finally {
      setStatus("idle");
    }
  };

  useEffect(() => {
    getProviders().then((providers) => {
      setHasGoogle(!!providers?.google);
    });
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleGoogleSignup = () => {
    signIn("google", { callbackUrl: "/post-login" });
  };

  return (
    <>
      <Header />
      <main className="relative z-20 container-hero flex items-center justify-center h-[calc(100vh-80px)] -mt-36 overflow-hidden">
        <div className="w-full max-w-sm mx-auto p-8" style={{
          background: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(20px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.6)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
        }}>
          <div className="label mb-4">Get Started</div>
          <h1 className="mono text-xl font-bold mb-2">Create your account</h1>
          <p className="text-sm text-neutral-500 mb-6">
            Set up your credentials to get started.
          </p>

          {status === "error" && (
            <div className="mono mb-4 p-3 bg-red-50 text-red-600 text-xs border border-red-200">
              {errorMessage}
            </div>
          )}

          {hasGoogle && (
            <>
              <button
                onClick={handleGoogleSignup}
                type="button"
                className="w-full flex items-center justify-center gap-2 bg-white border border-neutral-300 text-neutral-700 hover:border-neutral-900 font-medium py-2.5 px-4 transition-colors text-sm"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Sign up with Google
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-neutral-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="mono px-3 text-[10px] text-neutral-400 uppercase tracking-widest" style={{ background: 'rgba(255,255,255,0.3)' }}>
                    Or continue with
                  </span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label block mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="symbol-input w-full"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="label block mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="symbol-input w-full"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={status === "loading"}
              className="mono w-full bg-neutral-900 text-white py-2.5 px-4 text-[12px] font-semibold uppercase tracking-wider hover:opacity-85 transition-opacity disabled:opacity-50"
            >
              {status === "loading" ? "Creating..." : "Create account"}
            </button>
          </form>

          <div className="mt-5 text-center text-sm text-neutral-500">
            Already have an account?{" "}
            <a href="/login" className="mono font-medium text-neutral-900 hover:opacity-70 transition-opacity text-[12px] uppercase tracking-wider">
              Sign in
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
