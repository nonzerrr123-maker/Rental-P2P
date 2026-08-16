import type { ReactNode } from "react";
import { requireUserPage } from "@/lib/auth/authorization";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireUserPage("/dashboard");
  return children;
}
