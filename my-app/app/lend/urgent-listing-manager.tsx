"use client";

import { useState } from "react";

type Listing = {
  id: string;
  title: string;
  status: string;
  urgentEnabled: boolean;
  urgentReservationFeeRate: string;
};

export default function UrgentListingManager({ initialItems }: { initialItems: Listing[] }) {
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  const toggle = async (item: Listing) => {
    setBusyId(item.id);
    setMessage("");
    try {
      const response = await fetch(`/api/rental-items/${item.id}/urgent`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !item.urgentEnabled }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.message || "อัปเดตโหมดยืมด่วนไม่สำเร็จ");
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, urgentEnabled: payload.item.urgentEnabled } : entry));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "อัปเดตโหมดยืมด่วนไม่สำเร็จ");
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
      <div className="rounded-2xl border border-[#D4AF37]/30 bg-[#fffaf0] p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black tracking-[2px] text-[#9d7d13]">URGENT AVAILABILITY</p>
            <h2 className="mt-1 text-xl font-black">เปิด / ปิด “ยืมด่วน” ได้ตลอด</h2>
            <p className="mt-1 text-sm text-neutral-600">ปิดเมื่อไม่สะดวกส่งมอบ และเปิดอีกครั้งเมื่อพร้อม โดยไม่ต้องสร้างประกาศใหม่</p>
          </div>
          <span className="text-xs text-neutral-500">ค่าจองใช้เรตที่บันทึกไว้ในแต่ละประกาศ</span>
        </div>

        {message && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{message}</p>}
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <article key={item.id} className="flex items-center justify-between gap-4 rounded-xl border bg-white p-4">
              <div className="min-w-0">
                <p className="truncate font-black">{item.title}</p>
                <p className="mt-1 text-xs text-neutral-500">{item.status} · ค่าจอง {Number(item.urgentReservationFeeRate) * 100}%</p>
              </div>
              <button
                type="button"
                disabled={busyId === item.id || item.status !== "ACTIVE"}
                onClick={() => void toggle(item)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-black disabled:opacity-40 ${item.urgentEnabled ? "bg-neutral-950 text-white" : "border bg-white"}`}
              >
                {busyId === item.id ? "กำลังบันทึก..." : item.urgentEnabled ? "⚡ เปิดอยู่" : "ปิดอยู่"}
              </button>
            </article>
          ))}
          {!items.length && <p className="text-sm text-neutral-500">ยังไม่มีประกาศสำหรับตั้งค่า</p>}
        </div>
      </div>
    </section>
  );
}
