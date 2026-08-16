import type { ReactNode } from "react";
import { requireUserPage } from "@/lib/auth/authorization";

export default async function RentalLayout({ children }: { children: ReactNode }) {
  await requireUserPage("/rental");
  return children;
}
