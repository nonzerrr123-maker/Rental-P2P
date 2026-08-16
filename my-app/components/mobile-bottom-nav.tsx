"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CompassIcon, HomeIcon, MessageIcon, PlusIcon, UserIcon, UsersIcon } from "@/components/ui/icons";

const items = [
  { href: "/", label: "หน้าแรก", icon: HomeIcon, exact: true },
  { href: "/rent", label: "ค้นหา", icon: CompassIcon },
  { href: "/community", label: "คอมมู", icon: UsersIcon },
  { href: "/chat", label: "แชต", icon: MessageIcon },
  { href: "/dashboard", label: "บัญชี", icon: UserIcon },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-[70] border-t border-[var(--line)] bg-[color:rgba(250,249,246,0.94)] px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden" aria-label="เมนูแอปมือถือ">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {items.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link key={href} href={href} className={`relative flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-extrabold ${active ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}>
              <span className={`grid h-7 w-10 place-items-center rounded-full ${active ? "bg-[var(--gold-soft)] text-[var(--gold-strong)]" : ""}`}><Icon size={20}/></span>
              {label}
            </Link>
          );
        })}
      </div>
      <Link href="/lend" className="absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded-full bg-[var(--ink)] p-3 text-white shadow-lg" aria-label="ลงของให้ยืม"><PlusIcon/></Link>
    </nav>
  );
}
