import type { ReactNode } from "react";
import { requireVerifiedUserPage } from "@/lib/auth/authorization";

export default async function LendLayout({ children }: { children: ReactNode }) {
  await requireVerifiedUserPage("/lend");
  return children;
}
