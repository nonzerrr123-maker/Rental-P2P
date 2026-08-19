"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ActivityNavLinks from "@/components/activity-nav-links";
import UserAvatar from "@/components/user-avatar";
import {
  BellIcon,
  BoltIcon,
  CompassIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MapPinIcon,
  MessageIcon,
  PlusIcon,
  ShieldCheckIcon,
  SlidersIcon,
  UserIcon,
  UsersIcon,
} from "@/components/ui/icons";

type NavUser = {
  id: string;
  displayName: string;
  role: "USER" | "ADMIN" | "SUPERADMIN";
  verificationStatus: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
};

export default function AuthNavActions() {
  const router = useRouter();
  const [user, setUser] = useState<NavUser | null>(null);
  const [resolved, setResolved] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((result) => { if (active) setUser(result?.user ?? null); })
      .catch(() => undefined)
      .finally(() => { if (active) setResolved(true); });

    const refreshAvatar = () => setAvatarVersion((current) => current + 1);
    window.addEventListener("borow:avatar-updated", refreshAvatar);

    return () => {
      active = false;
      window.removeEventListener("borow:avatar-updated", refreshAvatar);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const logout = async () => {
    setMenuOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/");
    router.refresh();
  };

  if (!resolved) {
    return <div className="h-10 w-10 animate-pulse rounded-xl bg-[var(--surface-2)] sm:w-24" aria-label="กำลังโหลดบัญชี" />;
  }

  if (!user) {
    return (
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Link href="/login" className="whitespace-nowrap rounded-xl px-2.5 py-2 text-xs font-extrabold text-[var(--muted-strong)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] sm:px-3 sm:text-sm">เข้าสู่ระบบ</Link>
        <Link href="/register" className="hidden whitespace-nowrap rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-black text-white hover:bg-black sm:inline-flex">สมัครสมาชิก</Link>
      </div>
    );
  }

  const isAdmin = user.role === "ADMIN" || user.role === "SUPERADMIN";
  const canRent = isAdmin || user.verificationStatus === "VERIFIED";
  const closeMenu = () => setMenuOpen(false);
  const menuLinkClass = "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-extrabold text-[var(--muted-strong)] transition hover:bg-[var(--surface-2)] hover:text-[var(--ink)]";

  return (
    <div className="flex shrink-0 items-center gap-1.5 lg:gap-2">
      <div className="hidden xl:block"><ActivityNavLinks compact /></div>
      {isAdmin && (
        <Link href="/admin" className="hidden h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-[var(--line)] bg-white px-3 text-xs font-black text-[var(--muted-strong)] hover:border-[var(--gold-line)] 2xl:inline-flex">
          <ShieldCheckIcon size={17} />
          <span>Admin</span>
        </Link>
      )}
      <Link href={canRent ? "/lend" : "/verification"} className="hidden h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-[var(--gold)] px-3.5 text-xs font-black text-[var(--ink)] hover:bg-[var(--gold-stronger)] lg:inline-flex">
        {canRent ? <PlusIcon size={17} /> : <ShieldCheckIcon size={17} />}
        <span>{canRent ? "ลงของ" : "ยืนยันตัวตน"}</span>
      </Link>

      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((current) => !current)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls="account-menu"
          className={`group inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border bg-white p-1.5 text-sm font-bold transition lg:pl-1.5 lg:pr-2.5 ${menuOpen ? "border-[var(--gold-line)] shadow-[var(--shadow-xs)]" : "border-[var(--line)] hover:border-[var(--gold-line)]"}`}
        >
          <UserAvatar userId={user.id} displayName={user.displayName} version={avatarVersion} className="h-7 w-7 rounded-lg text-[10px]" />
          <span className="hidden max-w-24 truncate lg:inline xl:max-w-28">{user.displayName}</span>
          <span className="sr-only">เปิดเมนูบัญชี</span>
        </button>

        {menuOpen && (
          <div
            id="account-menu"
            role="menu"
            aria-label="เมนูบัญชี"
            className="absolute right-0 top-[calc(100%+0.65rem)] z-[70] w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-[22px] border border-[var(--line)] bg-white p-2 shadow-[0_24px_64px_rgba(18,18,18,0.16)]"
          >
            <div className="flex items-center gap-3 px-3 py-3">
              <UserAvatar userId={user.id} displayName={user.displayName} version={avatarVersion} className="h-11 w-11 rounded-2xl text-sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-[var(--ink)]">{user.displayName}</p>
                <p className="mt-0.5 text-[11px] font-bold text-[var(--muted)]">
                  {user.verificationStatus === "VERIFIED" ? "ยืนยันตัวตนแล้ว" : "บัญชียังยืนยันตัวตนไม่สมบูรณ์"}
                </p>
              </div>
            </div>

            <div className="border-t border-[var(--line)] pt-2">
              <Link href="/profile" onClick={closeMenu} role="menuitem" className={menuLinkClass}><UserIcon size={18}/><span>โปรไฟล์ของฉัน</span></Link>
              <Link href="/dashboard" onClick={closeMenu} role="menuitem" className={menuLinkClass}><LayoutDashboardIcon size={18}/><span>Dashboard</span></Link>
              <Link href="/settings" onClick={closeMenu} role="menuitem" className={menuLinkClass}><SlidersIcon size={18}/><span>ตั้งค่าบัญชี</span></Link>
              <Link href="/chat" onClick={closeMenu} role="menuitem" className={menuLinkClass}><MessageIcon size={18}/><span>ข้อความ</span></Link>
              <Link href="/notifications" onClick={closeMenu} role="menuitem" className={menuLinkClass}><BellIcon size={18}/><span>การแจ้งเตือน</span></Link>
            </div>

            <div className="mt-2 border-t border-[var(--line)] pt-2 md:hidden">
              <p className="px-3 pb-1 pt-1 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--muted)]">สำรวจ</p>
              <Link href="/rent" onClick={closeMenu} role="menuitem" className={menuLinkClass}><CompassIcon size={18}/><span>ค้นหาของ</span></Link>
              <Link href="/location" onClick={closeMenu} role="menuitem" className={menuLinkClass}><MapPinIcon size={18}/><span>ของใกล้ฉัน</span></Link>
              <Link href="/rent?urgent=true" onClick={closeMenu} role="menuitem" className={menuLinkClass}><BoltIcon size={18}/><span>ยืมด่วน</span></Link>
              <Link href="/community" onClick={closeMenu} role="menuitem" className={menuLinkClass}><UsersIcon size={18}/><span>คอมมูหาของ</span></Link>
            </div>

            <div className="mt-2 border-t border-[var(--line)] pt-2">
              <Link href={canRent ? "/lend" : "/verification"} onClick={closeMenu} role="menuitem" className={`${menuLinkClass} text-[var(--gold-strong)]`}>
                {canRent ? <PlusIcon size={18}/> : <ShieldCheckIcon size={18}/>}<span>{canRent ? "ลงของให้ยืม" : "ยืนยันตัวตน"}</span>
              </Link>
              {isAdmin && <Link href="/admin" onClick={closeMenu} role="menuitem" className={menuLinkClass}><ShieldCheckIcon size={18}/><span>Admin</span></Link>}
              <button type="button" onClick={() => void logout()} role="menuitem" className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-extrabold text-red-600 transition hover:bg-red-50">
                <LogOutIcon size={18}/><span>ออกจากระบบ</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
