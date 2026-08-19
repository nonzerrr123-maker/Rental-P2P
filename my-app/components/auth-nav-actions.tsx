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
      <Link href="/dashboard" className="group inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-[var(--line)] bg-white p-1.5 text-sm font-bold hover:border-[var(--gold-line)] lg:pl-1.5 lg:pr-2.5">
        <UserAvatar userId={user.id} displayName={user.displayName} version={avatarVersion} className="h-7 w-7 rounded-lg text-[10px]" />
        <span className="hidden max-w-24 truncate lg:inline xl:max-w-28">{user.displayName}</span>
        <LayoutDashboardIcon size={15} className="hidden text-[var(--muted)] 2xl:block" />
      </Link>
      <button type="button" onClick={logout} className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] lg:grid" aria-label="ออกจากระบบ">
        <LogOutIcon size={18} />
      </button>
      <Link href="/dashboard" className="sr-only"><UserIcon />บัญชีของฉัน</Link>
    </div>
  );
}
