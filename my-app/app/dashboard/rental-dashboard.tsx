"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import SiteHeader from "@/components/site-header";
import RentalLifecycleStepper from "@/components/rental-lifecycle-stepper";
import { BoltIcon, CreditCardIcon, LayoutDashboardIcon, MessageIcon, PackageIcon, PlusIcon, UserIcon, UsersIcon } from "@/components/ui/icons";
import { StatusPill } from "@/components/ui/primitives";
import type { RentalRequestSummary } from "@/lib/rental/bookings";

const money = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });
const statusLabel: Record<string, string> = {
  REQUESTED: "รอเจ้าของตอบรับ", ACCEPTED: "ตอบรับแล้ว", REJECTED: "ปฏิเสธแล้ว", WAITING_PAYMENT: "รอชำระเงิน",
  PAID: "ชำระแล้ว", WAITING_PICKUP: "รอรับของ", RENTING: "กำลังยืม", RETURNING: "กำลังคืน", RETURNED: "คืนแล้ว",
  COMPLETED: "สำเร็จ", DISPUTED: "มีข้อพิพาท", CANCELLED: "ยกเลิก", EXPIRED: "หมดอายุ",
};

function statusTone(status: string): "neutral" | "gold" | "success" | "danger" {
  if (["REJECTED", "CANCELLED", "EXPIRED"].includes(status)) return "danger";
  if (["REQUESTED", "ACCEPTED", "WAITING_PAYMENT"].includes(status)) return "gold";
  if (["PAID", "RETURNED", "COMPLETED"].includes(status)) return "success";
  return "neutral";
}

function RequestCard({ request, perspective, onAction, busy, error }: {
  request: RentalRequestSummary;
  perspective: "BORROWER" | "LENDER";
  onAction: (id: string, action: "ACCEPT" | "REJECT" | "CANCEL") => void;
  busy: boolean;
  error: string;
}) {
  const borrowerCanCancel = perspective === "BORROWER" && ["REQUESTED", "WAITING_PAYMENT"].includes(request.status);
  const lenderCanCancel = perspective === "LENDER" && request.status === "WAITING_PAYMENT";

  return (
    <article className="min-w-0 p-4 sm:p-5">
      <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Link href={`/rent/${request.item.id}`} className="min-w-0 max-w-full break-words text-base font-black hover:text-[var(--gold-strong)] sm:truncate">{request.item.title}</Link>
            <StatusPill tone={statusTone(request.status)}>{statusLabel[request.status] ?? request.status}</StatusPill>
            {request.isUrgent && <StatusPill tone="gold"><span className="inline-flex items-center gap-1"><BoltIcon size={12} />ยืมด่วน</span></StatusPill>}
          </div>
          <p className="mt-2 break-words text-xs leading-5 text-[var(--muted)]">{dateTime.format(new Date(request.startsAt))} – {dateTime.format(new Date(request.endsAt))}</p>
          <p className="mt-1 break-words text-xs leading-5 text-[var(--muted)]">{request.pricingMode === "HOUR" ? "รายชั่วโมง" : "รายวัน"} · {Number(request.durationUnits)} หน่วย · ค่าเช่า ฿{money.format(Number(request.rentalAmount))} · ประกัน ฿{money.format(Number(request.depositAmount))}</p>
          <p className="mt-1 break-words text-xs text-[var(--muted)]">{perspective === "LENDER" ? `ผู้ยืม: ${request.borrower.displayName}` : `ผู้ให้ยืม: ${request.lender.displayName}`}</p>
          <div className="mt-4 max-w-xl overflow-x-auto pb-1"><RentalLifecycleStepper status={request.status} compact /></div>
          {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}
        </div>

        <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:w-auto sm:min-w-[280px] lg:flex lg:min-w-0 lg:flex-wrap lg:justify-end">
          <Link href={`/chat?rentalRequestId=${encodeURIComponent(request.id)}`} className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-black sm:px-4"><MessageIcon size={16} />แชต</Link>
          {perspective === "BORROWER" && request.status === "WAITING_PAYMENT" && <Link href={`/checkout/${request.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[var(--gold)] px-3 text-sm font-black text-[var(--ink)] sm:px-4"><CreditCardIcon size={16} />ชำระเงิน</Link>}
          {perspective === "LENDER" && request.status === "REQUESTED" && <>
            <button type="button" disabled={busy} onClick={() => onAction(request.id, "REJECT")} className="min-h-11 whitespace-nowrap rounded-xl border border-red-200 px-3 text-sm font-black text-red-600 disabled:opacity-40 sm:px-4">ปฏิเสธ</button>
            <button type="button" disabled={busy} onClick={() => onAction(request.id, "ACCEPT")} className="min-h-11 whitespace-nowrap rounded-xl bg-[var(--ink)] px-3 text-sm font-black text-white disabled:opacity-40 sm:px-4">{busy ? "กำลังบันทึก..." : "ตอบรับ"}</button>
          </>}
          {(borrowerCanCancel || lenderCanCancel) && <button type="button" disabled={busy} onClick={() => onAction(request.id, "CANCEL")} className="min-h-11 whitespace-nowrap rounded-xl border border-[var(--line)] px-3 text-sm font-black text-[var(--muted-strong)] disabled:opacity-40 sm:px-4">ยกเลิก</button>}
        </div>
      </div>
    </article>
  );
}

export function RentalDashboard({ displayName, initialIncoming, initialOutgoing }: { displayName: string; initialIncoming: RentalRequestSummary[]; initialOutgoing: RentalRequestSummary[] }) {
  const [role, setRole] = useState<"BORROWER" | "LENDER">("BORROWER");
  const [incoming, setIncoming] = useState(initialIncoming);
  const [outgoing, setOutgoing] = useState(initialOutgoing);
  const [busyId, setBusyId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const current = role === "LENDER" ? incoming : outgoing;
  const stats = useMemo(() => {
    const all = [...incoming, ...outgoing];
    return {
      active: all.filter((r) => !["REJECTED", "CANCELLED", "EXPIRED", "COMPLETED"].includes(r.status)).length,
      waitingPayment: all.filter((r) => r.status === "WAITING_PAYMENT").length,
      actionNeeded: incoming.filter((r) => r.status === "REQUESTED").length,
    };
  }, [incoming, outgoing]);

  const applyAction = async (id: string, action: "ACCEPT" | "REJECT" | "CANCEL") => {
    setBusyId(id);
    setErrors((value) => ({ ...value, [id]: "" }));
    try {
      const response = await fetch(`/api/rental-requests/${id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const payload = await response.json() as { ok: boolean; request?: RentalRequestSummary; message?: string };
      if (!response.ok || !payload.ok || !payload.request) {
        setErrors((value) => ({ ...value, [id]: payload.message || "อัปเดตคำขอไม่สำเร็จ" }));
        return;
      }
      setIncoming((requests) => requests.map((r) => r.id === id ? payload.request! : r));
      setOutgoing((requests) => requests.map((r) => r.id === id ? payload.request! : r));
    } catch {
      setErrors((value) => ({ ...value, [id]: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ" }));
    } finally {
      setBusyId("");
    }
  };

  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="bb-label">My rentals</p>
            <h1 className="mt-2 break-words text-3xl font-black tracking-[-0.045em] sm:text-4xl">สวัสดี {displayName}</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">ดูสิ่งที่ต้องทำต่อจากสถานะจริงของแต่ละ Rental</p>
          </div>
          <div className="grid w-full grid-cols-2 rounded-xl border border-[var(--line)] bg-white p-1 sm:w-auto sm:min-w-64">
            <button onClick={() => setRole("BORROWER")} className={`min-h-10 whitespace-nowrap rounded-lg px-3 text-sm font-black sm:px-4 ${role === "BORROWER" ? "bg-[var(--ink)] text-white" : "text-[var(--muted)]"}`}>ฉันยืม</button>
            <button onClick={() => setRole("LENDER")} className={`min-h-10 whitespace-nowrap rounded-lg px-3 text-sm font-black sm:px-4 ${role === "LENDER" ? "bg-[var(--ink)] text-white" : "text-[var(--muted)]"}`}>ฉันให้ยืม</button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-2 min-[440px]:grid-cols-3 sm:gap-4">
          {[[LayoutDashboardIcon, "กำลังดำเนินการ", stats.active], [CreditCardIcon, "รอชำระ", stats.waitingPayment], [PackageIcon, "รอตอบรับ", stats.actionNeeded]].map(([Icon, label, value]) => {
            const Visual = Icon as typeof PackageIcon;
            return <div key={String(label)} className="min-w-0 rounded-2xl border border-[var(--line)] bg-white p-3 sm:p-5"><Visual size={17} className="text-[var(--gold-strong)]" /><p className="mt-2 text-2xl font-black">{String(value)}</p><p className="mt-1 text-[10px] leading-4 text-[var(--muted)] sm:text-xs">{String(label)}</p></div>;
          })}
        </div>

        <div className="hide-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
          <Link href="/profile" className="inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-[var(--line)] bg-white px-4 text-xs font-black"><UserIcon size={15} />โปรไฟล์</Link>
          <Link href="/lend" className="inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-[var(--line)] bg-white px-4 text-xs font-black"><PlusIcon size={15} />ลงของ</Link>
          <Link href="/community" className="inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-[var(--line)] bg-white px-4 text-xs font-black"><UsersIcon size={15} />คอมมู</Link>
        </div>

        <section className="mt-6 min-w-0 overflow-hidden rounded-[26px] border border-[var(--line)] bg-white shadow-[var(--shadow-xs)]">
          <div className="border-b border-[var(--line)] p-4 sm:p-5"><h2 className="font-black">{role === "LENDER" ? "คำขอที่เข้ามา" : "คำขอที่ฉันส่ง"}</h2><p className="mt-1 text-xs text-[var(--muted)]">{current.length} รายการ</p></div>
          <div className="divide-y divide-[var(--line)]">
            {current.map((request) => <RequestCard key={request.id} request={request} perspective={role} onAction={(id, action) => void applyAction(id, action)} busy={busyId === request.id} error={errors[request.id] || ""} />)}
            {current.length === 0 && <div className="p-8 text-center text-sm text-[var(--muted)] sm:p-10">ยังไม่มีรายการในหมวดนี้</div>}
          </div>
        </section>
      </div>
    </main>
  );
}
