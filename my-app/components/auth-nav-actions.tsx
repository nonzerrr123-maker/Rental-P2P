"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ActivityNavLinks from "@/components/activity-nav-links";
import UserAvatar from "@/components/user-avatar";
import { LayoutDashboardIcon, LogOutIcon, PlusIcon, ShieldCheckIcon, UserIcon } from "@/components/ui/icons";

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

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/");
    router.refresh();
  };

  if (!resolved) {
    return <div className="h-10 w-28 animate-pulse rounded-xl bg-[var(--surface-2)]" aria-label="กำลังโหลดบัญชี" />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login" className="rounded-xl px-3 py-2 text-sm font-extrabold text-[var(--muted-strong)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]">เข้าสู่ระบบ</Link>
        <Link href="/register" className="hidden rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-black text-white hover:bg-black sm:inline-flex">สมัครสมาชิก</Link>
      </div>
    );
  }

  const isAdmin = user.role === "ADMIN" || user.role === "SUPERADMIN";
  const canRent = isAdmin || user.verificationStatus === "VERIFIED";

  return (
    <div className="flex items-center gap-2">
      <div className="hidden lg:block"><ActivityNavLinks compact /></div>
      {isAdmin && (
        <Link href="/admin" className="hidden h-10 items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 text-xs font-black text-[var(--muted-strong)] hover:border-[var(--gold-line)] xl:inline-flex">
          <ShieldCheckIcon size={17}/> Admin
        </Link>
      )}
      <Link href={canRent ? "/lend" : "/verification"} className="hidden h-10 items-center gap-2 rounded-xl bg-[var(--gold)] px-3.5 text-xs font-black text-[var(--ink)] hover:bg-[var(--gold-stronger)] md:inline-flex">
        {canRent ? <PlusIcon size={17}/> : <ShieldCheckIcon size={17}/>} {canRent ? "ลงของ" : "ยืนยันตัวตน"}
      </Link>
      <Link href="/dashboard" className="group inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--line)] bg-white pl-1.5 pr-2.5 text-sm font-bold hover:border-[var(--gold-line)]">
        <UserAvatar userId={user.id} displayName={user.displayName} version={avatarVersion} className="h-7 w-7 rounded-lg text-[10px]" />
        <span className="hidden max-w-28 truncate sm:inline">{user.displayName}</span>
        <LayoutDashboardIcon size={15} className="hidden text-[var(--muted)] xl:block"/>
      </Link>
      <button type="button" onClick={logout} className="hidden h-10 w-10 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] sm:grid" aria-label="ออกจากระบบ">
        <LogOutIcon size={18}/>
      </button>
      <Link href="/dashboard" className="sr-only"><UserIcon/>บัญชีของฉัน</Link>
    </div>
  );
}
