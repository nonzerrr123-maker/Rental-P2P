import type { ReactNode } from "react";
import { requireUserPage } from "@/lib/auth/authorization";

export default async function ReviewLayout({ children }: { children: ReactNode }) {
  await requireUserPage("/review");
  return children;
}
