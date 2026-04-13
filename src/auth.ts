
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { createUser, getUser, upsertUserByEmail, verifyPassword } from "@/lib/user-store";
import { isAllowed } from "@/lib/rate-limit";

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Credentials({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            authorize: async (credentials) => {
                const parsed = z
                    .object({
                        email: z.string(),
                        password: z.string().min(1),
                    })
                    .safeParse(credentials);

                if (!parsed.success) return null;

                // Rate limit: 10 login attempts per email per 15 minutes
                if (!isAllowed(`login:${parsed.data.email.toLowerCase()}`, 10, 15 * 60 * 1000)) {
                    throw new Error("Too many login attempts. Please try again in 15 minutes.");
                }

                const { email, password } = parsed.data;

                const demoUser = process.env.DEMO_USERNAME || "demovault";
                const demoPass = process.env.DEMO_PASSWORD || "demovault";

                if (email === demoUser && password === demoPass) {
                    return {
                        id: "demo-user",
                        email: "demo@example.com",
                        name: "Demo User",
                    };
                }
                
                const existing = await getUser(email);
                if (!existing) return null;

                const ok = await verifyPassword(existing, password);
                if (!ok) return null;
                return { id: existing.id, email: existing.email, name: existing.name ?? undefined };
            },
        }),
        ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
            ? [
                  Google({
                      clientId: process.env.GOOGLE_CLIENT_ID,
                      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                  }),
              ]
            : []),
    ],
    pages: {
        signIn: "/login",
        error: "/login", // Redirect back to login page on error
    },
    callbacks: {
        async jwt({ token, user, account }) {
            if (user?.email) {
                // Demo user gets full access without a DB lookup
                if ((user as any).id === "demo-user") {
                    token.paid = true;
                    token.email = user.email;
                    token.isEmailVerified = true;
                    return token;
                }
                const stored = await upsertUserByEmail(user.email, {
                    name: user.name ?? undefined,
                });
                token.paid = stored.stripePaid ?? false;
                token.email = stored.email;
                token.isEmailVerified = stored.emailVerified ?? false;
            } else if (token.email) {
                const stored = await getUser(token.email as string);
                if (stored) {
                    token.paid = stored.stripePaid ?? false;
                    token.isEmailVerified = stored.emailVerified ?? false;
                }
            }

            // If user logs in with Google, we might want to store them in our JSON db too
            if (account?.provider === "google" && user?.email) {
                // Keep token enrichment only; user storage is disabled in demo-only mode.
            }
            return token;
        },
        async session({ session, token }) {
            if (token.sub && session.user) {
                session.user.id = token.sub;
            }
            if (session.user) {
                session.user.paid = (token.paid as boolean) ?? false;
                session.user.isEmailVerified = (token.isEmailVerified as boolean) ?? false;
            }
            return session;
        },
    },
});
