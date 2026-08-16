"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthNavActions from "@/components/auth-nav-actions";
import { BrandMark } from "@/components/ui/primitives";
import { BoltIcon, CompassIcon, MapPinIcon, PlusIcon, UsersIcon } from "@/components/ui/icons";

const links = [
  { href: "/rent", label: "ค้นหาของ", icon: CompassIcon },
  { href: "/location", label: "ใกล้ฉัน", icon: MapPinIcon },
  { href: "/community", label: "คอมมูหาของ", icon: UsersIcon },
];

export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[color:rgba(250,249,246,0.92)] backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-5 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Borow Borow หน้าแรก" className="shrink-0"><BrandMark/></Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="เมนูหลัก">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-extrabold transition ${active ? "bg-white text-[var(--ink)] shadow-[var(--shadow-xs)] ring-1 ring-[var(--line)]" : "text-[var(--muted-strong)] hover:bg-white/70 hover:text-[var(--ink)]"}`}
              >
                <Icon size={17}/>{label}
              </Link>
            );
          })}
          <Link href="/rent?urgent=true" className="ml-1 inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-extrabold text-[var(--gold-strong)] hover:bg-[var(--gold-soft)]">
            <BoltIcon size={17}/>ยืมด่วน
          </Link>
          <Link href="/lend" className="hidden h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-extrabold text-[var(--muted-strong)] hover:bg-white/70 hover:text-[var(--ink)] xl:inline-flex">
            <PlusIcon size={17}/>ปล่อยของให้ยืม
          </Link>
        </nav>

        <AuthNavActions />
      </div>
    </header>
  );
}
