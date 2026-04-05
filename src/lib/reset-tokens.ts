import crypto from "crypto";
import clientPromise from "@/lib/mongodb";

type ResetToken = {
  tokenHash: string;
  email: string;
  expiresAt: Date;
};

async function getCollection() {
  const client = await clientPromise;
  const db = client.db("pricevault");
  const col = db.collection<ResetToken>("reset_tokens");
  // TTL index — MongoDB deletes documents automatically after expiresAt
  await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await col.createIndex({ tokenHash: 1 }, { unique: true });
  return col;
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Returns the raw token (sent in the email link). Only the hash is stored.
export async function createResetToken(email: string): Promise<string> {
  const col = await getCollection();
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // One active token per email at a time
  await col.deleteMany({ email });
  await col.insertOne({ tokenHash, email, expiresAt });

  return token;
}

// Validates and consumes the token. Returns the email if valid, null otherwise.
export async function consumeResetToken(token: string): Promise<string | null> {
  const col = await getCollection();
  const tokenHash = hashToken(token);

  const doc = await col.findOneAndDelete({
    tokenHash,
    expiresAt: { $gt: new Date() },
  });

  return doc?.email ?? null;
}
