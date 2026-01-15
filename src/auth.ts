
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";

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
                        email: z.string(), // Allow username-like values for demo
                        password: z.string().min(4),
                    })
                    .safeParse(credentials);

                if (!parsed.success) return null;

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

                return null;
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
            return session;
        },
    },
});
