"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span className="ml-1 rounded-full bg-[#c9a227] px-1.5 py-0.5 text-[10px] font-black text-white">{count > 99 ? "99+" : count}</span>;
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

    fetch("/api/activity/summary", { cache: "no-store" })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((payload) => { if (payload) applyPayload(payload); })
      .catch(() => undefined);

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
    ? "rounded-lg border px-3 py-2 text-sm font-bold"
    : "rounded-xl border bg-white px-4 py-2.5 text-sm font-black";

  return (
    <div className="flex items-center gap-2">
      <Link href="/chat" className={base} aria-label={`แชต ยังไม่อ่าน ${chatUnread} ข้อความ`}>
        💬<span className="hidden sm:inline"> แชต</span><Badge count={chatUnread} />
      </Link>
      <Link href="/notifications" className={base} aria-label={`การแจ้งเตือน ยังไม่อ่าน ${notificationUnread} รายการ`}>
        🔔<span className="hidden sm:inline"> แจ้งเตือน</span><Badge count={notificationUnread} />
      </Link>
    </div>
  );
}
