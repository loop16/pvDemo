import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/user-store";

export default async function SubscribeLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/login");
  }

  const user = await getUser(session.user.email);
  if (user?.stripePaid) {
    redirect("/app");
  }

  return <>{children}</>;
}
