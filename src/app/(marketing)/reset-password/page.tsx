"use client";

import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    // Request form state
    const [email, setEmail] = useState("");
    const [requestStatus, setRequestStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
    const [requestError, setRequestError] = useState("");

    // Confirm form state
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [confirmStatus, setConfirmStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [confirmError, setConfirmError] = useState("");

    const handleRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setRequestStatus("loading");
        setRequestError("");

        try {
            const res = await fetch("/api/auth/reset-password/request", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            if (!res.ok) {
                setRequestStatus("error");
                setRequestError(data.error || "Something went wrong.");
            } else {
                setRequestStatus("sent");
            }
        } catch {
            setRequestStatus("error");
            setRequestError("An unexpected error occurred.");
        }
    };

    const handleConfirm = async (e: React.FormEvent) => {
        e.preventDefault();
        setConfirmError("");

        if (password !== confirmPassword) {
            setConfirmError("Passwords don't match.");
            return;
        }

        setConfirmStatus("loading");

        try {
            const res = await fetch("/api/auth/reset-password/confirm", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ token, password }),
            });
            const data = await res.json();
            if (!res.ok) {
                setConfirmStatus("error");
                setConfirmError(data.error || "Something went wrong.");
            } else {
                setConfirmStatus("success");
            }
        } catch {
            setConfirmStatus("error");
            setConfirmError("An unexpected error occurred.");
        }
    };

    const cardStyle = {
        background: "rgba(255,255,255,0.15)",
        backdropFilter: "blur(20px) saturate(1.6)",
        WebkitBackdropFilter: "blur(20px) saturate(1.6)",
        borderRadius: "20px",
        border: "1px solid rgba(255,255,255,0.6)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)",
    };

    // ── Confirm: success state ───────────────────────────────
    if (token && confirmStatus === "success") {
        return (
            <div className="w-full max-w-sm mx-auto p-8" style={cardStyle}>
                <div className="label mb-4">Password reset</div>
                <h1 className="mono text-xl font-bold mb-2">All done</h1>
                <p className="text-sm text-neutral-500 mb-6">Your password has been updated.</p>
                <a
                    href="/login"
                    className="mono w-full inline-flex items-center justify-center bg-neutral-900 text-white py-2.5 px-4 text-[12px] font-semibold uppercase tracking-wider hover:opacity-85 transition-opacity"
                >
                    Sign in
                </a>
            </div>
        );
    }

    // ── Confirm: new password form ───────────────────────────
    if (token) {
        return (
            <div className="w-full max-w-sm mx-auto p-8" style={cardStyle}>
                <div className="label mb-4">Password reset</div>
                <h1 className="mono text-xl font-bold mb-2">New password</h1>
                <p className="text-sm text-neutral-500 mb-6">Choose a new password for your account.</p>

                {confirmError && (
                    <div className="mono mb-4 p-3 bg-red-50 text-red-600 text-xs border border-red-200">
                        {confirmError}
                    </div>
                )}

                <form onSubmit={handleConfirm} className="space-y-4">
                    <div>
                        <label htmlFor="password" className="label block mb-1.5">New password</label>
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
                    <div>
                        <label htmlFor="confirmPassword" className="label block mb-1.5">Confirm password</label>
                        <input
                            id="confirmPassword"
                            type="password"
                            required
                            minLength={8}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="symbol-input w-full"
                            placeholder="••••••••"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={confirmStatus === "loading"}
                        className="mono w-full bg-neutral-900 text-white py-2.5 px-4 text-[12px] font-semibold uppercase tracking-wider hover:opacity-85 transition-opacity disabled:opacity-50"
                    >
                        {confirmStatus === "loading" ? "Updating..." : "Set new password"}
                    </button>
                </form>
            </div>
        );
    }

    // ── Request: sent state ──────────────────────────────────
    if (requestStatus === "sent") {
        return (
            <div className="w-full max-w-sm mx-auto p-8" style={cardStyle}>
                <div className="label mb-4">Password reset</div>
                <h1 className="mono text-xl font-bold mb-2">Check your email</h1>
                <p className="text-sm text-neutral-500 mb-6 leading-relaxed">
                    If <span className="text-neutral-800 font-medium">{email}</span> has an account, a reset link is on its way. The link expires in 1 hour.
                </p>
                <a
                    href="/login"
                    className="mono text-[12px] text-neutral-500 hover:text-neutral-900 uppercase tracking-wider transition-colors"
                >
                    ← Back to sign in
                </a>
            </div>
        );
    }

    // ── Request: email form (default) ────────────────────────
    return (
        <div className="w-full max-w-sm mx-auto p-8" style={cardStyle}>
            <div className="label mb-4">Password reset</div>
            <h1 className="mono text-xl font-bold mb-2">Forgot password?</h1>
            <p className="text-sm text-neutral-500 mb-6">
                Enter your email and we'll send you a reset link.
            </p>

            {requestError && (
                <div className="mono mb-4 p-3 bg-red-50 text-red-600 text-xs border border-red-200">
                    {requestError}
                </div>
            )}

            <form onSubmit={handleRequest} className="space-y-4">
                <div>
                    <label htmlFor="email" className="label block mb-1.5">Email</label>
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
                <button
                    type="submit"
                    disabled={requestStatus === "loading"}
                    className="mono w-full bg-neutral-900 text-white py-2.5 px-4 text-[12px] font-semibold uppercase tracking-wider hover:opacity-85 transition-opacity disabled:opacity-50"
                >
                    {requestStatus === "loading" ? "Sending..." : "Send reset link"}
                </button>
            </form>

            <div className="mt-5 text-center">
                <a
                    href="/login"
                    className="mono text-[12px] text-neutral-500 hover:text-neutral-900 uppercase tracking-wider transition-colors"
                >
                    ← Back to sign in
                </a>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "";
        };
    }, []);

    return (
        <>
            <Header />
            <main className="relative z-20 container-hero flex items-center justify-center h-[calc(100vh-80px)] -mt-36 overflow-hidden">
                <Suspense fallback={<div className="mono text-neutral-400 text-sm">Loading...</div>}>
                    <ResetPasswordForm />
                </Suspense>
            </main>
        </>
    );
}
