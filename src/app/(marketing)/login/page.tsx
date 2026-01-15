"use client";

import { useState, Suspense, useEffect } from "react";
import { signIn, getProviders } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import Header from "@/components/Header";

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // "error" param comes from NextAuth if something fails
    const errorParam = searchParams.get("error");

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
            const res = await signIn("credentials", {
                redirect: false,
                email,
                password,
            });

            if (res?.error) {
                setStatus("error");
                setErrorMessage(
                    res.error === "CredentialsSignin"
                        ? "Invalid credentials."
                        : "Something went wrong." // Could be "User already exists" thrown from authorize
                );
            } else {
                // success
                router.refresh();
                router.push("/app"); // Redirect to home or dashboard
            }
        } catch (err) {
            console.error(err);
            setStatus("error");
            setErrorMessage("An unexpected error occurred.");
        }
    };

    useEffect(() => {
        getProviders().then((providers) => {
            setHasGoogle(!!providers?.google);
        });
    }, []);

    const handleGoogleLogin = () => {
        signIn("google", { callbackUrl: "/app" });
    };

    return (
        <div className="card w-full max-w-md mx-auto">
            <h1 className="text-2xl font-bold mb-2">
                Welcome back
            </h1>
            <p className="text-sm text-neutral-600 mb-6">
                Enter your details to sign in.
            </p>

            {/* Error Alert */}
            {(errorMessage || errorParam) && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded border border-red-100">
                    {errorMessage || (errorParam === "CredentialsSignin" ? "Login failed." : "Authentication error.")}
                </div>
            )}

            {hasGoogle && (
                <>
                    {/* Google Button */}
                    <button
                        onClick={handleGoogleLogin}
                        type="button"
                        className="w-full flex items-center justify-center gap-2 bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50 font-medium py-2.5 px-4 rounded-md transition-colors"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                fill="#4285F4"
                            />
                            <path
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                fill="#34A853"
                            />
                            <path
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                fill="#FBBC05"
                            />
                            <path
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                fill="#EA4335"
                            />
                        </svg>
                        Sign in with Google
                    </button>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-neutral-200" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white px-2 text-neutral-500">Or continue with</span>
                        </div>
                    </div>
                </>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label
                        htmlFor="email"
                        className="block text-sm font-medium text-neutral-700 mb-1"
                    >
                        Username
                    </label>
                    <input
                        id="email"
                        type="text"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="symbol-input w-full"
                        placeholder="demovault"
                    />
                </div>

                <div>
                    <label
                        htmlFor="password"
                        className="block text-sm font-medium text-neutral-700 mb-1"
                    >
                        Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        required
                        minLength={4}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="symbol-input w-full"
                        placeholder="••••••••"
                    />
                </div>

                <button
                    type="submit"
                    disabled={status === "loading"}
                    className="w-full bg-black text-white py-2.5 px-4 rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                    {status === "loading"
                        ? "Processing..."
                        : "Sign in"}
                </button>
            </form>
        </div>
    );
}

export default function LoginPage() {
    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "";
        };
    }, []);

    return (
        <>
            <Header />
            <main className="container-hero flex items-center justify-center h-[calc(100vh-80px)] -mt-36 overflow-hidden">
                <Suspense fallback={<div>Loading...</div>}>
                    <LoginForm />
                </Suspense>
            </main>
        </>
    );
}
