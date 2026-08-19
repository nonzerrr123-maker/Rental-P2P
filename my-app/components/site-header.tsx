"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthNavActions from "@/components/auth-nav-actions";
import { BrandMark } from "@/components/ui/primitives";
import { BoltIcon, CompassIcon, MapPinIcon, UsersIcon } from "@/components/ui/icons";

const links = [
  { href: "/rent", label: "ค้นหาของ", icon: CompassIcon },
  { href: "/location", label: "ใกล้ฉัน", icon: MapPinIcon },
  { href: "/community", label: "คอมมูหาของ", icon: UsersIcon },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[color:rgba(250,249,246,0.94)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 md:h-[68px] lg:gap-4 lg:px-8">
        <Link href="/" aria-label="Borow Borow หน้าแรก" className="shrink-0">
          <BrandMark />
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 xl:flex" aria-label="เมนูหลัก">
          {links.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 text-sm font-extrabold transition ${active ? "bg-white text-[var(--ink)] shadow-[var(--shadow-xs)] ring-1 ring-[var(--line)]" : "text-[var(--muted-strong)] hover:bg-white/70 hover:text-[var(--ink)]"}`}
              >
                <Icon size={17} />
                <span>{label}</span>
              </Link>
            );
          })}
          <Link href="/rent?urgent=true" className="inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 text-sm font-extrabold text-[var(--gold-strong)] transition hover:bg-[var(--gold-soft)]">
            <BoltIcon size={17} />
            <span>ยืมด่วน</span>
          </Link>
        </nav>

        <nav className="hidden shrink-0 items-center gap-1 md:flex xl:hidden" aria-label="เมนูหลักแบบย่อ">
          {links.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                title={label}
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition ${active ? "bg-white text-[var(--ink)] shadow-[var(--shadow-xs)] ring-1 ring-[var(--line)]" : "text-[var(--muted-strong)] hover:bg-white/70 hover:text-[var(--ink)]"}`}
              >
                <Icon size={18} />
              </Link>
            );
          })}
          <Link href="/rent?urgent=true" aria-label="ยืมด่วน" title="ยืมด่วน" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[var(--gold-strong)] transition hover:bg-[var(--gold-soft)]">
            <BoltIcon size={18} />
          </Link>
        </nav>

        <div className="shrink-0">
          <AuthNavActions />
        </div>
      </div>
    </header>
  );
}
