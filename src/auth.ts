
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { getUser, createUser, verifyPassword } from "@/lib/user-store";

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
        Credentials({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
                isSignup: { label: "Is Signup", type: "text", optional: true },
            },
            authorize: async (credentials) => {
                const parsed = z
                    .object({
                        email: z.string(), // Relaxed validation to allow "demo"
                        password: z.string().min(4), // Relaxed min length for "demo"
                        isSignup: z.string().optional(),
                    })
                    .safeParse(credentials);

                if (!parsed.success) return null;

                const { email, password, isSignup } = parsed.data;

                // DEMO LOGIN CHECK
                if (email === "demo" && password === "demo") {
                    return {
                        id: "demo-user",
                        email: "demo@example.com",
                        name: "Demo User",
                    };
                }

                // Restore strict email validation for non-demo users
                const emailSchema = z.string().email();
                const emailResult = emailSchema.safeParse(email);
                if (!emailResult.success) return null;

                let user = await getUser(email);

                if (isSignup === "true") {
                    if (user) {
                        throw new Error("User already exists");
                    }
                    user = await createUser(email, password);
                    return { id: user.id, email: user.email, name: user.name };
                } else {
                    // Login
                    if (!user) return null;
                    const isValid = await verifyPassword(user, password);
                    if (!isValid) return null;
                    return { id: user.id, email: user.email, name: user.name };
                }
            },
        }),
    ],
    pages: {
        signIn: "/login",
        error: "/login", // Redirect back to login page on error
    },
    callbacks: {
        async jwt({ token, user, account }) {
            // If user logs in with Google, we might want to store them in our JSON db too
            if (account?.provider === "google" && user?.email) {
                // Check if user exists, if not create them (without password)
                const existing = await getUser(user.email);
                if (!existing) {
                    await createUser(user.email);
                }
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
