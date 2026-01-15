import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="h-screen flex flex-col">
      <AppHeader />
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
