import bcrypt from "bcryptjs";
import { z } from "zod";
import clientPromise from "@/lib/mongodb";

export const UserSchema = z.object({
    id: z.string(),
    email: z.string().email(),
    passwordHash: z.string().optional(),
    name: z.string().optional(),
    createdAt: z.string(),
    stripeCustomerId: z.string().optional(),
    stripeSubscriptionStatus: z.string().optional(),
    stripePaid: z.boolean().optional(),
    stripeCheckoutSessionId: z.string().optional(),
    stripePriceId: z.string().optional(),
    tradingViewUsername: z.string().optional(),
    emailVerified: z.boolean().optional(),
    apiKey: z.string().optional(),
});

export type User = z.infer<typeof UserSchema>;

async function getCollection() {
    const client = await clientPromise;
    const db = client.db("pricevault");
    const col = db.collection<User>("users");
    // Ensure indexes exist (no-op after first run)
    await col.createIndex({ email: 1 }, { unique: true });
    await col.createIndex({ stripeCustomerId: 1 }, { sparse: true });
    await col.createIndex({ apiKey: 1 }, { sparse: true });
    return col;
}

export async function getUser(email: string): Promise<User | null> {
    const col = await getCollection();
    const doc = await col.findOne({ email }, { projection: { _id: 0 } });
    return doc ?? null;
}

export async function createUser(
    email: string,
    password?: string,
    name?: string
): Promise<User> {
    const col = await getCollection();

    const user: User = {
        id: crypto.randomUUID(),
        email,
        createdAt: new Date().toISOString(),
        ...(name ? { name } : {}),
    };

    if (password) {
        user.passwordHash = await bcrypt.hash(password, 10);
    }

    try {
        await col.insertOne({ ...user } as any);
    } catch (err: any) {
        if (err.code === 11000) throw new Error("User already exists");
        throw err;
    }

    return user;
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
    if (!user.passwordHash) return false;
    return bcrypt.compare(password, user.passwordHash);
}

export async function upsertUserByEmail(
    email: string,
    data: Partial<User> = {}
): Promise<User> {
    const col = await getCollection();

    const update: Partial<User> = { ...data };
    delete update.id;
    delete update.email;
    delete update.createdAt;

    const result = await col.findOneAndUpdate(
        { email },
        {
            $set: update,
            $setOnInsert: {
                id: crypto.randomUUID(),
                email,
                createdAt: new Date().toISOString(),
            },
        },
        { upsert: true, returnDocument: "after", projection: { _id: 0 } }
    );

    return result as User;
}

export async function updatePassword(email: string, newPassword: string): Promise<void> {
    const col = await getCollection();
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await col.updateOne({ email }, { $set: { passwordHash } });
}

export async function getUserByApiKey(apiKey: string): Promise<User | null> {
    const col = await getCollection();
    const doc = await col.findOne({ apiKey }, { projection: { _id: 0 } });
    return doc ?? null;
}

export async function updateUserByStripeCustomerId(
    stripeCustomerId: string,
    data: Partial<User>
): Promise<User | null> {
    const col = await getCollection();

    const update: Partial<User> = { ...data };
    delete update.id;
    delete update.email;
    delete update.createdAt;

    const result = await col.findOneAndUpdate(
        { stripeCustomerId },
        { $set: update },
        { returnDocument: "after", projection: { _id: 0 } }
    );

    return result ?? null;
}
