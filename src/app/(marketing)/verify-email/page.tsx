"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    const cardStyle = {
        background: "rgba(255,255,255,0.15)",
        backdropFilter: "blur(20px) saturate(1.6)",
        WebkitBackdropFilter: "blur(20px) saturate(1.6)",
        borderRadius: "20px",
        border: "1px solid rgba(255,255,255,0.6)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)",
    };

    if (success) {
        return (
            <div className="w-full max-w-sm mx-auto p-8" style={cardStyle}>
                <div className="label mb-4">Email verified</div>
                <h1 className="mono text-xl font-bold mb-2">You're verified</h1>
                <p className="text-sm text-neutral-500 mb-6">Your email address has been confirmed.</p>
                <a
                    href="/app"
                    className="mono w-full inline-flex items-center justify-center bg-neutral-900 text-white py-2.5 px-4 text-[12px] font-semibold uppercase tracking-wider hover:opacity-85 transition-opacity"
                >
                    Go to app
                </a>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full max-w-sm mx-auto p-8" style={cardStyle}>
                <div className="label mb-4">Email verification</div>
                <h1 className="mono text-xl font-bold mb-2">Link expired</h1>
                <p className="text-sm text-neutral-500 mb-6">
                    This verification link is invalid or has expired. Sign in and request a new one from your account.
                </p>
                <a
                    href="/login"
                    className="mono w-full inline-flex items-center justify-center bg-neutral-900 text-white py-2.5 px-4 text-[12px] font-semibold uppercase tracking-wider hover:opacity-85 transition-opacity"
                >
                    Sign in
                </a>
            </div>
        );
    }

    return (
        <div className="w-full max-w-sm mx-auto p-8" style={cardStyle}>
            <div className="label mb-4">Email verification</div>
            <h1 className="mono text-xl font-bold mb-2">Check your inbox</h1>
            <p className="text-sm text-neutral-500 leading-relaxed">
                We sent a verification link to your email when you signed up. Click the link to verify your address.
            </p>
        </div>
    );
}

export default function VerifyEmailPage() {
    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = ""; };
    }, []);

    return (
        <>
            <Header />
            <main className="relative z-20 container-hero flex items-center justify-center h-[calc(100vh-80px)] -mt-36 overflow-hidden">
                <Suspense fallback={<div className="mono text-neutral-400 text-sm">Loading...</div>}>
                    <VerifyEmailContent />
                </Suspense>
            </main>
        </>
    );
}
