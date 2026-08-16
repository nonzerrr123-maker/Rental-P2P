"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/site-header";
import { BellIcon, CheckIcon, ChevronRightIcon } from "@/components/ui/icons";
import type { NotificationSummary } from "@/lib/notifications/service";

const dateTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });

function notificationHref(item: NotificationSummary): string {
  if (item.relatedEntityType === "RENTAL_REQUEST" && item.relatedEntityId) return `/chat?rentalRequestId=${encodeURIComponent(item.relatedEntityId)}`;
  if (item.relatedEntityType === "MESSAGE") return "/chat";
  if (item.relatedEntityType === "COMMUNITY_REQUEST" && item.relatedEntityId) return `/community/${item.relatedEntityId}`;
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
    let firstLoad = true;

    const apply = (payload: { ok?: boolean; items?: NotificationSummary[]; unreadCount?: number }) => {
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
        .then(apply)
        .catch((cause: unknown) => {
          if (active) setError(cause instanceof Error ? cause.message : "โหลดการแจ้งเตือนไม่สำเร็จ");
        })
        .finally(() => {
          if (active && firstLoad) {
            firstLoad = false;
            setLoading(false);
          }
        });
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
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="bb-label">Activity</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">การแจ้งเตือน</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">{unreadCount} รายการยังไม่ได้อ่าน</p>
          </div>
          <button type="button" onClick={() => void markAll()} disabled={unreadCount === 0} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 text-xs font-black disabled:opacity-40">
            <CheckIcon size={15} />อ่านทั้งหมด
          </button>
        </div>

        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        {loading ? <p className="mt-7 text-sm text-[var(--muted)]">กำลังโหลด...</p> : (
          <div className="mt-6 overflow-hidden rounded-[24px] border border-[var(--line)] bg-white shadow-[var(--shadow-xs)]">
            {items.map((item) => (
              <button key={item.id} type="button" onClick={() => void openNotification(item)} className={`flex w-full items-start gap-3 border-b border-[var(--line)] p-4 text-left last:border-b-0 hover:bg-[var(--surface)] sm:p-5 ${item.readAt ? "" : "bg-[var(--gold-soft)]/55"}`}>
                <span className={`mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${item.readAt ? "bg-[var(--surface-2)] text-[var(--muted)]" : "bg-white text-[var(--gold-strong)]"}`}><BellIcon size={17} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <b className="text-sm">{item.title}</b>
                    <span className="shrink-0 text-[10px] text-[var(--muted)]">{dateTime.format(new Date(item.createdAt))}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{item.body}</p>
                </div>
                <ChevronRightIcon size={16} className="mt-2 shrink-0 text-[var(--muted)]" />
              </button>
            ))}
            {items.length === 0 && <div className="p-10 text-center"><BellIcon className="mx-auto text-[var(--muted)]" /><p className="mt-3 text-sm text-[var(--muted)]">ยังไม่มีการแจ้งเตือน</p></div>}
          </div>
        )}
        <p className="mt-4 text-center text-[10px] text-[var(--muted)]">อัปเดตอัตโนมัติเมื่อเปิดหน้านี้อยู่</p>
      </div>
    </main>
  );
}
