
import { promises as fs } from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { z } from "zod";

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
});

export type User = z.infer<typeof UserSchema>;

const dataDir = path.join(process.cwd(), "data");
const usersFile = path.join(dataDir, "users.json");

// Helper to ensure data directory exists
async function ensureDataDir() {
    await fs.mkdir(dataDir, { recursive: true });
}

async function readUsers(): Promise<User[]> {
    try {
        const raw = await fs.readFile(usersFile, "utf-8");
        return JSON.parse(raw) as User[];
    } catch (error: any) {
        if (error.code === "ENOENT") return [];
        throw error;
    }
}

async function writeUsers(users: User[]): Promise<void> {
    await ensureDataDir();
    await fs.writeFile(usersFile, JSON.stringify(users, null, 2));
}

export async function getUser(email: string): Promise<User | null> {
    const users = await readUsers();
    return users.find((u) => u.email === email) || null;
}

export async function createUser(email: string, password?: string, name?: string) {
    const existing = await getUser(email);
    if (existing) {
        throw new Error("User already exists");
    }

    const user: User = {
        id: crypto.randomUUID(),
        email,
        name,
        createdAt: new Date().toISOString(),
    };

    if (password) {
        user.passwordHash = await bcrypt.hash(password, 10);
    }

    const users = await readUsers();
    users.push(user);
    await writeUsers(users);

    return user;
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
    if (!user.passwordHash) return false;
    return bcrypt.compare(password, user.passwordHash);
}

export async function upsertUserByEmail(email: string, data: Partial<User> = {}): Promise<User> {
    const users = await readUsers();
    const idx = users.findIndex((u) => u.email === email);
    if (idx === -1) {
        const user: User = {
            id: crypto.randomUUID(),
            email,
            createdAt: new Date().toISOString(),
            ...data,
        };
        users.push(user);
        await writeUsers(users);
        return user;
    }

    const updated: User = { ...users[idx], ...data };
    users[idx] = updated;
    await writeUsers(users);
    return updated;
}

export async function updateUserByStripeCustomerId(
    stripeCustomerId: string,
    data: Partial<User>
): Promise<User | null> {
    const users = await readUsers();
    const idx = users.findIndex((u) => u.stripeCustomerId === stripeCustomerId);
    if (idx === -1) return null;

    const updated: User = { ...users[idx], ...data };
    users[idx] = updated;
    await writeUsers(users);
    return updated;
}
