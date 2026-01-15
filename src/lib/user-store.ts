
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
});

export type User = z.infer<typeof UserSchema>;

const dataDir = path.join(process.cwd(), "data");
const usersFile = path.join(dataDir, "users.json");

// Helper to ensure data directory exists
async function ensureDataDir() {
    await fs.mkdir(dataDir, { recursive: true });
}

export async function getUser(email: string): Promise<User | null> {
    try {
        const raw = await fs.readFile(usersFile, "utf-8");
        const users: User[] = JSON.parse(raw);
        return users.find((u) => u.email === email) || null;
    } catch (error: any) {
        if (error.code === "ENOENT") return null;
        throw error;
    }
}

export async function createUser(email: string, password?: string) {
    await ensureDataDir();

    const existing = await getUser(email);
    if (existing) {
        throw new Error("User already exists");
    }

    const user: User = {
        id: crypto.randomUUID(),
        email,
        createdAt: new Date().toISOString(),
    };

    if (password) {
        user.passwordHash = await bcrypt.hash(password, 10);
    }

    // Read existing users or start fresh
    let users: User[] = [];
    try {
        const raw = await fs.readFile(usersFile, "utf-8");
        users = JSON.parse(raw);
    } catch (error: any) {
        if (error.code !== "ENOENT") throw error;
    }

    users.push(user);
    await fs.writeFile(usersFile, JSON.stringify(users, null, 2));

    return user;
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
    if (!user.passwordHash) return false;
    return bcrypt.compare(password, user.passwordHash);
}
