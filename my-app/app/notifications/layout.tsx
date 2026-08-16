import type { ReactNode } from "react";
import { requireUserPage } from "@/lib/auth/authorization";

export default async function NotificationsLayout({ children }: { children: ReactNode }) {
  await requireUserPage("/notifications");
  return children;
}
