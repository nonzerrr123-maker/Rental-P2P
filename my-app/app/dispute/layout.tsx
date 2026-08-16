import type { ReactNode } from "react";
import { requireUserPage } from "@/lib/auth/authorization";

export default async function DisputeLayout({ children }: { children: ReactNode }) {
  await requireUserPage("/dispute");
  return children;
}
