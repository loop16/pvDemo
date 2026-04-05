import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/user-store";
import HalftoneCanvas from "@/components/HalftoneCanvasV1";
import GridLines from "@/components/GridLines";

export default async function SubscribeLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/login");
  }

  const user = await getUser(session.user.email);
  if (user?.stripePaid) {
    redirect("/app");
  }

  return (
    <>
      <div className="fixed inset-0 z-0">
        <HalftoneCanvas />
      </div>
      <GridLines />
      {children}
    </>
  );
}
