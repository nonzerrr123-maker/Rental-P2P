"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BellIcon, MessageIcon } from "@/components/ui/icons";

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-[var(--gold)] px-1 py-0.5 text-center text-[9px] font-black leading-none text-[var(--ink)] ring-2 ring-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function ActivityNavLinks({ compact = false }: { compact?: boolean }) {
  const [chatUnread, setChatUnread] = useState(0);
  const [notificationUnread, setNotificationUnread] = useState(0);

  useEffect(() => {
    let active = true;
    const applyPayload = (payload: { ok?: boolean; chatUnread?: number; notificationUnread?: number }) => {
      if (!active || !payload.ok) return;
      setChatUnread(Number(payload.chatUnread || 0));
      setNotificationUnread(Number(payload.notificationUnread || 0));
    };
    const refresh = () => {
      if (document.hidden) return;
      fetch("/api/activity/summary", { cache: "no-store" })
        .then(async (response) => (response.ok ? response.json() : null))
        .then((payload) => { if (payload) applyPayload(payload); })
        .catch(() => undefined);
    };

    refresh();
    const interval = window.setInterval(refresh, 5000);
    const onVisibility = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const base = compact
    ? "relative grid h-9 w-9 place-items-center rounded-xl border border-[var(--line)] bg-white text-[var(--muted-strong)] hover:border-[var(--gold-line)] hover:text-[var(--ink)]"
    : "relative inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-bold text-[var(--muted-strong)] hover:border-[var(--gold-line)] hover:text-[var(--ink)]";

  return (
    <div className="flex items-center gap-2">
      <Link href="/chat" className={base} aria-label={`แชต ยังไม่อ่าน ${chatUnread} ข้อความ`}>
        <MessageIcon size={18}/>{!compact && <span>แชต</span>}<Badge count={chatUnread}/>
      </Link>
      <Link href="/notifications" className={base} aria-label={`การแจ้งเตือน ยังไม่อ่าน ${notificationUnread} รายการ`}>
        <BellIcon size={18}/>{!compact && <span>แจ้งเตือน</span>}<Badge count={notificationUnread}/>
      </Link>
    </div>
  );
}
