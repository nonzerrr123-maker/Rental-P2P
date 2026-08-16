"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type NavUser = {
  displayName: string;
  role: "USER" | "ADMIN" | "SUPERADMIN";
  verificationStatus: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
};

export default function AuthNavActions() {
  const [user, setUser] = useState<NavUser | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (active) setUser(result?.user ?? null);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setResolved(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/");
  };

  if (!resolved) {
    return <div className="h-10 w-36 animate-pulse rounded-lg bg-gray-100" aria-label="กำลังโหลดบัญชี" />;
  }

  if (!user) {
    return (
      <div className="flex gap-2">
        <Link href="/login" className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold hover:border-[#C9A227]">เข้าสู่ระบบ</Link>
        <Link href="/lend" className="rounded-lg bg-[#C9A227] px-4 py-2 text-sm font-black hover:bg-[#b18b1f]">ลงของให้ยืม</Link>
      </div>
    );
  }

  const isAdmin = user.role === "ADMIN" || user.role === "SUPERADMIN";
  const canRent = isAdmin || user.verificationStatus === "VERIFIED";

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className="hidden max-w-32 truncate text-sm font-semibold sm:inline">{user.displayName}</span>
      {isAdmin && <Link href="/admin" className="rounded-lg border px-3 py-2 text-sm font-bold">Admin</Link>}
      <Link href="/dashboard" className="rounded-lg border px-3 py-2 text-sm font-bold">Dashboard</Link>
      <Link href={canRent ? "/lend" : "/verification"} className="rounded-lg bg-[#C9A227] px-3 py-2 text-sm font-black">
        {canRent ? "ลงของให้ยืม" : "ยืนยันตัวตน"}
      </Link>
      <button onClick={logout} className="rounded-lg bg-black px-3 py-2 text-sm font-bold text-white">ออกจากระบบ</button>
    </div>
  );
}
