import type { ReactNode } from "react";
import { requireUserPage } from "@/lib/auth/authorization";

export default async function ChatLayout({ children }: { children: ReactNode }) {
  await requireUserPage("/chat");
  return children;
}
