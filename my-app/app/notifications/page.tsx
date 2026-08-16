"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ActivityNavLinks from "@/components/activity-nav-links";
import type { NotificationSummary } from "@/lib/notifications/service";

const dateTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });

function notificationHref(item: NotificationSummary): string {
  if (item.relatedEntityType === "RENTAL_REQUEST" && item.relatedEntityId) {
    return `/chat?rentalRequestId=${encodeURIComponent(item.relatedEntityId)}`;
  }
  if (item.relatedEntityType === "MESSAGE") return "/chat";
  return "/dashboard";
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationSummary[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const applyPayload = (payload: { ok?: boolean; items?: NotificationSummary[]; unreadCount?: number }) => {
      if (!active || !payload.ok) return;
      setItems(payload.items ?? []);
      setUnreadCount(Number(payload.unreadCount || 0));
      setError("");
    };
    const refresh = () => {
      if (document.hidden) return;
      fetch("/api/notifications?limit=100", { cache: "no-store" })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok || !payload.ok) throw new Error(payload.message || "โหลดการแจ้งเตือนไม่สำเร็จ");
          return payload;
        })
        .then(applyPayload)
        .catch((cause: unknown) => {
          if (active) setError(cause instanceof Error ? cause.message : "โหลดการแจ้งเตือนไม่สำเร็จ");
        });
    };

    fetch("/api/notifications?limit=100", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.message || "โหลดการแจ้งเตือนไม่สำเร็จ");
        return payload;
      })
      .then(applyPayload)
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "โหลดการแจ้งเตือนไม่สำเร็จ");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const interval = window.setInterval(refresh, 5000);
    const onVisibility = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const markAll = async () => {
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "MARK_ALL_READ" }),
    });
    if (!response.ok) return;
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
    setUnreadCount(0);
  };

  const openNotification = async (item: NotificationSummary) => {
    if (!item.readAt) {
      await fetch(`/api/notifications/${item.id}/read`, { method: "POST" }).catch(() => undefined);
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry));
      setUnreadCount((count) => Math.max(0, count - 1));
    }
    router.push(notificationHref(item));
  };

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-neutral-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="text-2xl font-black">Borow Borow<span className="text-[#c9a227]">.</span></Link>
          <div className="flex items-center gap-2"><ActivityNavLinks /><Link href="/dashboard" className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-black text-white">Dashboard</Link></div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><span className="text-xs font-black tracking-[3px] text-[#9d7d13]">NOTIFICATIONS</span><h1 className="mt-2 text-3xl font-black">การแจ้งเตือน</h1><p className="mt-2 text-neutral-500">มี {unreadCount} รายการที่ยังไม่ได้อ่าน</p></div>
          <button type="button" onClick={() => void markAll()} disabled={unreadCount === 0} className="rounded-xl border bg-white px-4 py-2 text-sm font-black text-[#967718] disabled:opacity-40">อ่านทั้งหมด</button>
        </div>

        {error && <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}
        {loading ? <p className="mt-7 text-sm text-neutral-500">กำลังโหลดจาก PostgreSQL...</p> : (
          <div className="mt-7 space-y-3">
            {items.map((item) => (
              <button key={item.id} type="button" onClick={() => void openNotification(item)} className={`w-full rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 ${item.readAt ? "bg-white" : "border-[#e5d49a] bg-[#fffaf0]"}`}>
                <div className="flex gap-4"><span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.readAt ? "bg-neutral-200" : "bg-[#c9a227]"}`} /><div className="min-w-0 flex-1"><div className="flex flex-col justify-between gap-1 sm:flex-row sm:gap-4"><b>{item.title}</b><span className="shrink-0 text-xs text-neutral-400">{dateTime.format(new Date(item.createdAt))}</span></div><p className="mt-1 text-sm leading-6 text-neutral-500">{item.body}</p><p className="mt-2 text-[11px] font-bold text-[#987914]">เปิดรายละเอียด →</p></div></div>
              </button>
            ))}
            {items.length === 0 && <div className="rounded-2xl border bg-white p-10 text-center text-sm text-neutral-500">ยังไม่มีการแจ้งเตือน</div>}
          </div>
        )}
        <p className="mt-5 text-xs text-neutral-400">อัปเดตทุก 5 วินาทีเฉพาะเมื่อแท็บเปิดอยู่</p>
      </div>
    </main>
  );
}
