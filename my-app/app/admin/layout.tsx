import Link from "next/link";
import type { ReactNode } from "react";
import SiteHeader from "@/components/site-header";
import { ShieldCheckIcon } from "@/components/ui/icons";
import { requireAdminPage } from "@/lib/auth/authorization";

const adminLinks = [
  ["/admin", "ภาพรวม", false],
  ["/admin/users", "ผู้ใช้", true],
  ["/admin/listings", "ประกาศ", true],
  ["/admin/rentals", "Rentals", false],
  ["/admin/payments", "Payments", false],
  ["/admin/settlements", "Settlements", false],
  ["/admin/disputes", "Disputes", false],
] as const;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdminPage("/admin");
  const links = adminLinks.filter(([, , superadminOnly]) => !superadminOnly || user.role === "SUPERADMIN");

  return (
    <>
      <SiteHeader />
      <div className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="mb-2 flex items-center gap-2 text-xs font-black text-[var(--muted-strong)]">
            <ShieldCheckIcon size={15} className="text-[var(--gold-strong)]" />
            {user.role === "SUPERADMIN" ? "Superadmin workspace" : "Admin workspace"}
          </div>
          <nav className="hide-scrollbar flex gap-2 overflow-x-auto pb-1" aria-label="เมนูผู้ดูแล">
            {links.map(([href, label]) => (
              <Link key={href} href={href} className="shrink-0 rounded-full border border-[var(--line)] bg-white px-3.5 py-2 text-xs font-black text-[var(--muted-strong)] hover:border-[var(--gold-line)] hover:text-[var(--ink)]">
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      {children}
    </>
  );
}
