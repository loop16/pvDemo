import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { getUser, upsertUserByEmail } from "@/lib/user-store";

export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUser(session.user.email);
  if (!user?.stripePaid) {
    return Response.json({ error: "Active subscription required" }, { status: 403 });
  }

  // Generate a 32-byte hex key
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const apiKey = "pv_" + Array.from(array).map(b => b.toString(16).padStart(2, "0")).join("");

  await upsertUserByEmail(session.user.email, { apiKey });

  return Response.json({ apiKey });
}
