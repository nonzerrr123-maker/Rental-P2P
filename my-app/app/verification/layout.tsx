import type { ReactNode } from "react";
import { requireUserPage } from "@/lib/auth/authorization";

export default async function VerificationLayout({ children }: { children: ReactNode }) {
  await requireUserPage("/verification");
  return children;
}
