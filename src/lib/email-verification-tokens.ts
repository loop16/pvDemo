import crypto from "crypto";
import clientPromise from "@/lib/mongodb";

type VerificationToken = {
  tokenHash: string;
  email: string;
  expiresAt: Date;
};

async function getCollection() {
  const client = await clientPromise;
  const db = client.db("pricevault");
  const col = db.collection<VerificationToken>("email_verification_tokens");
  await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await col.createIndex({ tokenHash: 1 }, { unique: true });
  return col;
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createVerificationToken(email: string): Promise<string> {
  const col = await getCollection();
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await col.deleteMany({ email });
  await col.insertOne({ tokenHash, email, expiresAt });

  return token;
}

export async function consumeVerificationToken(token: string): Promise<string | null> {
  const col = await getCollection();
  const tokenHash = hashToken(token);

  const doc = await col.findOneAndDelete({
    tokenHash,
    expiresAt: { $gt: new Date() },
  });

  return doc?.email ?? null;
}
