"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { RentalRequestSummary } from "@/lib/rental/bookings";

const money = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "short",
});

const statusLabel: Record<string, string> = {
  REQUESTED: "รอเจ้าของตอบรับ",
  ACCEPTED: "ตอบรับแล้ว",
  REJECTED: "ปฏิเสธแล้ว",
  WAITING_PAYMENT: "รอชำระเงิน",
  PAID: "ชำระแล้ว",
  WAITING_PICKUP: "รอรับของ",
  RENTING: "กำลังยืม",
  RETURNING: "กำลังคืน",
  RETURNED: "คืนแล้ว",
  COMPLETED: "สำเร็จ",
  DISPUTED: "มีข้อพิพาท",
  CANCELLED: "ยกเลิก",
  EXPIRED: "หมดอายุ",
};

function statusClass(status: string): string {
  if (["REJECTED", "CANCELLED", "EXPIRED"].includes(status)) return "bg-red-50 text-red-700";
  if (["WAITING_PAYMENT", "ACCEPTED", "REQUESTED"].includes(status)) return "bg-amber-50 text-amber-800";
  if (["COMPLETED", "RETURNED", "PAID"].includes(status)) return "bg-green-50 text-green-700";
  return "bg-neutral-100 text-neutral-700";
}

function RequestCard({
  request,
  perspective,
  onDecision,
  busy,
  error,
}: {
  request: RentalRequestSummary;
  perspective: "BORROWER" | "LENDER";
  onDecision: (id: string, decision: "ACCEPT" | "REJECT") => void;
  busy: boolean;
  error: string;
}) {
  return (
    <article className="p-5 md:p-6">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/rent/${request.item.id}`} className="font-black hover:text-[#987914]">{request.item.title}</Link>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(request.status)}`}>
              {statusLabel[request.status] ?? request.status}
            </span>
          </div>
          <p className="mt-2 text-sm text-neutral-500">
            {dateTime.format(new Date(request.startsAt))} → {dateTime.format(new Date(request.endsAt))}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {request.pricingMode === "HOUR" ? "รายชั่วโมง" : "รายวัน"} · {Number(request.durationUnits)} หน่วย · ค่าเช่า ฿{money.format(Number(request.rentalAmount))} · ประกัน ฿{money.format(Number(request.depositAmount))}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {perspective === "LENDER" ? `ผู้ยืม: ${request.borrower.displayName}` : `ผู้ให้ยืม: ${request.lender.displayName}`}
          </p>
          <p className="mt-1 text-xs text-neutral-400">Request {request.id}</p>
          {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm font-semibold text-red-700">{error}</p>}
        </div>

        {perspective === "LENDER" && request.status === "REQUESTED" ? (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecision(request.id, "REJECT")}
              className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-black text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
              Reject
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecision(request.id, "ACCEPT")}
              className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-black text-white hover:bg-neutral-800 disabled:opacity-40"
            >
              {busy ? "กำลังบันทึก..." : "Accept"}
            </button>
          </div>
        ) : (
          <span className="shrink-0 rounded-xl border px-4 py-2 text-xs font-bold text-neutral-400">Chat เปิดใน Phase 7</span>
        )}
      </div>
    </article>
  );
}

export function RentalDashboard({
  displayName,
  initialIncoming,
  initialOutgoing,
}: {
  displayName: string;
  initialIncoming: RentalRequestSummary[];
  initialOutgoing: RentalRequestSummary[];
}) {
  const [role, setRole] = useState<"BORROWER" | "LENDER">("BORROWER");
  const [incoming, setIncoming] = useState(initialIncoming);
  const [outgoing, setOutgoing] = useState(initialOutgoing);
  const [busyId, setBusyId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const current = role === "LENDER" ? incoming : outgoing;
  const stats = useMemo(() => {
    const all = [...incoming, ...outgoing];
    const active = all.filter((request) => !["REJECTED", "CANCELLED", "EXPIRED", "COMPLETED"].includes(request.status));
    const waitingPayment = all.filter((request) => request.status === "WAITING_PAYMENT");
    const acceptedValue = waitingPayment.reduce((sum, request) => sum + Number(request.rentalAmount), 0);
    return { active: active.length, waitingPayment: waitingPayment.length, acceptedValue };
  }, [incoming, outgoing]);

  const decide = async (id: string, decision: "ACCEPT" | "REJECT") => {
    setBusyId(id);
    setErrors((currentErrors) => ({ ...currentErrors, [id]: "" }));
    try {
      const response = await fetch(`/api/rental-requests/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const payload = await response.json() as {
        ok: boolean;
        request?: RentalRequestSummary;
        message?: string;
        code?: string;
      };
      if (!response.ok || !payload.ok || !payload.request) {
        const message = payload.code === "AVAILABILITY_CONFLICT"
          ? "มีคำขออื่นถูก Accept ในช่วงเวลานี้แล้ว จึงไม่สามารถรับคำขอนี้ได้"
          : payload.message || "อัปเดตคำขอไม่สำเร็จ";
        setErrors((currentErrors) => ({ ...currentErrors, [id]: message }));
        return;
      }
      const updated = payload.request;
      setIncoming((requests) => requests.map((request) => request.id === id ? updated : request));
      setOutgoing((requests) => requests.map((request) => request.id === id ? updated : request));
    } catch {
      setErrors((currentErrors) => ({ ...currentErrors, [id]: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่" }));
    } finally {
      setBusyId("");
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-neutral-950">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-2xl font-black">Borow Borow<span className="text-[#c9a227]">.</span></Link>
          <Link href="/rent" className="rounded-full border px-4 py-2 text-sm font-bold">Marketplace</Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-black tracking-[0.25em] text-[#9d7d13]">MY RENTALS</p>
            <h1 className="mt-2 text-4xl font-black">สวัสดี {displayName}</h1>
            <p className="mt-2 text-neutral-500">ติดตามคำขอยืมของคุณและตอบรับคำขอที่เข้ามาจากข้อมูลจริงใน PostgreSQL</p>
          </div>
          <div className="flex rounded-xl border bg-white p-1">
            <button onClick={() => setRole("BORROWER")} className={`rounded-lg px-4 py-2 text-sm font-black ${role === "BORROWER" ? "bg-neutral-950 text-white" : ""}`}>ฉันเป็นผู้ยืม</button>
            <button onClick={() => setRole("LENDER")} className={`rounded-lg px-4 py-2 text-sm font-black ${role === "LENDER" ? "bg-neutral-950 text-white" : ""}`}>ฉันเป็นผู้ให้ยืม</button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border bg-white p-5"><p className="text-sm text-neutral-500">กำลังดำเนินการ</p><p className="mt-2 text-3xl font-black">{stats.active}</p></div>
          <div className="rounded-2xl border bg-white p-5"><p className="text-sm text-neutral-500">รอชำระเงิน</p><p className="mt-2 text-3xl font-black">{stats.waitingPayment}</p></div>
          <div className="rounded-2xl border bg-white p-5"><p className="text-sm text-neutral-500">มูลค่าที่ Accept แล้ว</p><p className="mt-2 text-3xl font-black">฿{money.format(stats.acceptedValue)}</p></div>
        </div>

        <section className="mt-8 overflow-hidden rounded-3xl border border-neutral-200 bg-white">
          <div className="border-b p-5 md:p-6">
            <h2 className="text-xl font-black">{role === "LENDER" ? "คำขอที่เข้ามา" : "คำขอที่ฉันส่ง"}</h2>
            <p className="mt-1 text-sm text-neutral-500">{role === "LENDER" ? "Accept จะล็อกช่วงเวลาจริง และระบบป้องกันการ Accept ซ้อนในฐานข้อมูล" : "เมื่อเจ้าของ Accept สถานะจะเปลี่ยนเป็น WAITING_PAYMENT"}</p>
          </div>
          <div className="divide-y divide-neutral-100">
            {current.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                perspective={role}
                onDecision={(id, decision) => void decide(id, decision)}
                busy={busyId === request.id}
                error={errors[request.id] || ""}
              />
            ))}
            {current.length === 0 && <div className="p-12 text-center text-neutral-500">ยังไม่มีคำขอในหมวดนี้</div>}
          </div>
        </section>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/lend" className="rounded-xl bg-[#c9a227] px-5 py-3 font-black text-white">+ ลงของให้ยืม</Link>
          <Link href="/rent" className="rounded-xl border bg-white px-5 py-3 font-black">ค้นหาของให้ยืม</Link>
        </div>
      </div>
    </main>
  );
}
