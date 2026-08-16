"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { HandoverEventType, RentalFulfillmentSummary } from "@/lib/rental/fulfillment";

const money = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });
const steps = ["PAID", "WAITING_PICKUP", "RENTING", "RETURNING", "RETURNED", "COMPLETED"] as const;
const labels: Record<string, string> = {
  REQUESTED: "รอเจ้าของตอบรับ", ACCEPTED: "ตอบรับแล้ว", WAITING_PAYMENT: "รอชำระเงิน", PAID: "ชำระเงินแล้ว",
  WAITING_PICKUP: "รอรับของ", RENTING: "กำลังยืม", RETURNING: "กำลังคืน", RETURNED: "คืนของแล้ว",
  COMPLETED: "เสร็จสมบูรณ์", DISPUTED: "มีข้อพิพาท", REJECTED: "ปฏิเสธ", CANCELLED: "ยกเลิก", EXPIRED: "หมดอายุ",
};

function statusIndex(status: string): number {
  const index = steps.indexOf(status as (typeof steps)[number]);
  if (status === "DISPUTED") return Math.max(0, steps.indexOf("RETURNED"));
  return index;
}

function EvidenceLinks({ rentalId, event }: { rentalId: string; event: RentalFulfillmentSummary["handovers"][number] }) {
  if (!event.evidenceCount) return null;
  return <div className="mt-3 flex flex-wrap gap-2">{Array.from({ length: event.evidenceCount }, (_, index) => (
    <a key={index} target="_blank" rel="noreferrer" href={`/api/rentals/${rentalId}/handover/${event.id}/evidence/${index}`} className="rounded-lg border px-3 py-1.5 text-xs font-bold hover:border-[#c9a227]">หลักฐาน {index + 1}</a>
  ))}</div>;
}

function HandoverForm({ rental, type, onUpdated, disabled }: {
  rental: RentalFulfillmentSummary;
  type: HandoverEventType;
  onUpdated: (value: RentalFulfillmentSummary) => void;
  disabled: boolean;
}) {
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    setBusy(true); setError("");
    try {
      const form = new FormData();
      form.set("eventType", type);
      form.set("conditionNotes", notes);
      files.forEach((file) => form.append("files", file));
      const response = await fetch(`/api/rentals/${rental.id}/handover`, { method: "POST", body: form });
      const payload = await response.json() as { ok?: boolean; rental?: RentalFulfillmentSummary; message?: string };
      if (!response.ok || !payload.ok || !payload.rental) throw new Error(payload.message || "บันทึกไม่สำเร็จ");
      onUpdated(payload.rental); setFiles([]); setNotes("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ"); }
    finally { setBusy(false); }
  };
  return <div className="rounded-2xl border bg-neutral-50 p-4">
    <p className="font-black">{type === "PICKUP" ? "ยืนยันการส่งมอบ/รับของ" : "ยืนยันการคืน/รับคืน"}</p>
    <p className="mt-1 text-xs leading-5 text-neutral-500">ทั้งผู้ยืมและผู้ให้ยืมต้องยืนยันคนละหนึ่งครั้ง ระบบจึงจะเลื่อนสถานะ</p>
    <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} placeholder="บันทึกสภาพของหรือรายละเอียดเพิ่มเติม (ไม่บังคับ)" className="mt-3 min-h-24 w-full rounded-xl border bg-white p-3 text-sm outline-none focus:border-[#c9a227]" />
    <label className="mt-3 block text-xs font-bold text-neutral-600">แนบรูปหลักฐานได้สูงสุด 4 รูป · JPEG/PNG/WebP · ไม่เกิน 5MB/รูป<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 4))} className="mt-2 block w-full text-sm" /></label>
    {files.length > 0 && <p className="mt-2 text-xs text-neutral-500">เลือกแล้ว {files.length} รูป</p>}
    {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm font-semibold text-red-700">{error}</p>}
    <button type="button" disabled={disabled || busy} onClick={() => void submit()} className="mt-4 w-full rounded-xl bg-neutral-950 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{busy ? "กำลังบันทึก..." : type === "PICKUP" ? "ยืนยันการส่งมอบ" : "ยืนยันการคืนของ"}</button>
  </div>;
}

export default function RentalFulfillmentClient({ initialRental, actorId, isAdmin }: { initialRental: RentalFulfillmentSummary; actorId: string; isAdmin: boolean }) {
  const [rental, setRental] = useState(initialRental);
  const [contractBusy, setContractBusy] = useState(false);
  const [error, setError] = useState("");
  const perspective = actorId === rental.borrower.id ? "BORROWER" : actorId === rental.lender.id ? "LENDER" : "ADMIN";
  const ownContractConfirmed = perspective === "BORROWER" ? rental.contract?.borrowerConfirmedAt : perspective === "LENDER" ? rental.contract?.lenderConfirmedAt : null;
  const ownPickup = rental.handovers.some((event) => event.type === "PICKUP" && event.confirmedBy.id === actorId);
  const ownReturn = rental.handovers.some((event) => event.type === "RETURN" && event.confirmedBy.id === actorId);
  const currentIndex = statusIndex(rental.status);
  const totals = useMemo(() => Number(rental.pricing.rentalAmount) + Number(rental.pricing.depositAmount) + (rental.pricing.isUrgent ? Number(rental.pricing.urgentReservationFeeAmount) : 0), [rental]);

  const confirmContract = async () => {
    setContractBusy(true); setError("");
    try {
      const response = await fetch(`/api/rentals/${rental.id}/contract/confirm`, { method: "POST" });
      const payload = await response.json() as { ok?: boolean; rental?: RentalFulfillmentSummary; message?: string };
      if (!response.ok || !payload.ok || !payload.rental) throw new Error(payload.message || "ยืนยันสัญญาไม่สำเร็จ");
      setRental(payload.rental);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ"); }
    finally { setContractBusy(false); }
  };

  return <main className="min-h-screen bg-[#f7f7f5] text-neutral-950">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-5"><Link href="/" className="text-2xl font-black">Borow Borow<span className="text-[#c9a227]">.</span></Link><div className="flex gap-2"><Link href={`/chat?rentalRequestId=${encodeURIComponent(rental.id)}`} className="rounded-xl border px-4 py-2 text-sm font-bold">💬 แชต</Link><Link href={isAdmin ? "/admin/rentals" : "/dashboard"} className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-bold text-white">{isAdmin ? "Admin Rentals" : "Dashboard"}</Link></div></div></header>
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-xs font-black tracking-[0.25em] text-[#9d7d13]">RENTAL · {rental.id.slice(0, 8)}</p><h1 className="mt-2 text-4xl font-black">{rental.item.title}</h1><p className="mt-2 text-sm text-neutral-500">ผู้ยืม {rental.borrower.displayName} · ผู้ให้ยืม {rental.lender.displayName}</p><p className="mt-1 text-sm text-neutral-500">{dateTime.format(new Date(rental.schedule.startsAt))} → {dateTime.format(new Date(rental.schedule.endsAt))}</p></div><span className={`w-fit rounded-full px-4 py-2 text-sm font-black ${rental.status === "DISPUTED" ? "bg-red-50 text-red-700" : "bg-[#fbf5df] text-[#806515]"}`}>{labels[rental.status] ?? rental.status}</span></div>

      <section className="mt-8 rounded-3xl border bg-white p-6 md:p-8"><h2 className="text-xl font-black">สถานะจริงจาก PostgreSQL</h2><div className="mt-7 overflow-x-auto pb-3"><div className="flex min-w-[760px] items-start">{steps.map((step, index) => <div key={step} className="flex flex-1 items-start"><div className="flex flex-col items-center"><div className={`grid h-10 w-10 place-items-center rounded-full text-sm font-black ${index <= currentIndex ? "bg-[#c9a227] text-black" : "bg-neutral-100 text-neutral-400"}`}>{index < currentIndex ? "✓" : index + 1}</div><p className={`mt-3 max-w-24 text-center text-xs font-bold ${index <= currentIndex ? "text-neutral-950" : "text-neutral-400"}`}>{labels[step]}</p></div>{index < steps.length - 1 && <div className={`mt-5 h-1 flex-1 ${index < currentIndex ? "bg-[#c9a227]" : "bg-neutral-100"}`} />}</div>)}</div></div>{rental.status === "DISPUTED" && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">รายการถูก freeze จากข้อพิพาท ระบบจะไม่ complete หรือปล่อย settlement อัตโนมัติ</p>}</section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <div className="space-y-6">
          <section className="rounded-3xl border bg-white p-6"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-black">1. สัญญาการยืม</h2><p className="mt-1 text-sm text-neutral-500">snapshot ราคา ช่วงเวลา ของ และเงื่อนไขถูกสร้างจาก server</p></div><span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold">{rental.contract?.agreedAt ? "AGREED" : "WAITING"}</span></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-neutral-50 p-4 text-sm"><b>ผู้ยืม</b><p className="mt-1 text-neutral-500">{rental.contract?.borrowerConfirmedAt ? `✓ ${dateTime.format(new Date(rental.contract.borrowerConfirmedAt))}` : "ยังไม่ยืนยัน"}</p></div><div className="rounded-xl bg-neutral-50 p-4 text-sm"><b>ผู้ให้ยืม</b><p className="mt-1 text-neutral-500">{rental.contract?.lenderConfirmedAt ? `✓ ${dateTime.format(new Date(rental.contract.lenderConfirmedAt))}` : "ยังไม่ยืนยัน"}</p></div></div>
            {!isAdmin && ["PAID", "WAITING_PICKUP"].includes(rental.status) && !ownContractConfirmed && <button type="button" onClick={() => void confirmContract()} disabled={contractBusy} className="mt-4 w-full rounded-xl bg-[#c9a227] px-4 py-3 font-black text-white disabled:opacity-40">{contractBusy ? "กำลังยืนยัน..." : "ยืนยันสัญญาฉบับนี้"}</button>}{error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm font-semibold text-red-700">{error}</p>}
          </section>

          <section className="rounded-3xl border bg-white p-6"><h2 className="text-xl font-black">2. รับของ / คืนของ</h2><div className="mt-4 space-y-3">{rental.handovers.map((event) => <div key={event.id} className="rounded-2xl border p-4"><div className="flex flex-wrap items-center gap-2"><b>{event.type === "PICKUP" ? "PICKUP" : "RETURN"}</b><span className="rounded-full bg-neutral-100 px-2 py-1 text-xs font-bold">{event.confirmedBy.displayName}</span><span className="text-xs text-neutral-400">{dateTime.format(new Date(event.createdAt))}</span></div>{event.conditionNotes && <p className="mt-2 text-sm text-neutral-600">{event.conditionNotes}</p>}<EvidenceLinks rentalId={rental.id} event={event} /></div>)}{rental.handovers.length === 0 && <p className="rounded-xl bg-neutral-50 p-4 text-sm text-neutral-500">ยังไม่มี handover event</p>}</div>
            {!isAdmin && rental.status === "WAITING_PICKUP" && rental.contract?.agreedAt && !ownPickup && <div className="mt-4"><HandoverForm rental={rental} type="PICKUP" onUpdated={setRental} disabled={false} /></div>}
            {!isAdmin && ["RENTING", "RETURNING"].includes(rental.status) && !ownReturn && <div className="mt-4"><HandoverForm rental={rental} type="RETURN" onUpdated={setRental} disabled={false} /></div>}
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border bg-white p-6"><h2 className="text-xl font-black">ค่าใช้จ่าย</h2><div className="mt-4 space-y-3 text-sm"><div className="flex justify-between"><span className="text-neutral-500">ค่าเช่า</span><b>฿{money.format(Number(rental.pricing.rentalAmount))}</b></div>{rental.pricing.isUrgent && <div className="flex justify-between"><span className="text-neutral-500">ค่าจองด่วน</span><b>฿{money.format(Number(rental.pricing.urgentReservationFeeAmount))}</b></div>}<div className="flex justify-between"><span className="text-neutral-500">เงินประกัน</span><b>฿{money.format(Number(rental.pricing.depositAmount))}</b></div><div className="border-t pt-3"><div className="flex justify-between text-lg"><span className="font-black">snapshot รวม</span><b>฿{money.format(totals)}</b></div></div></div></section>
          <section className="rounded-3xl border bg-white p-6"><h2 className="text-xl font-black">เงินประกัน</h2><p className="mt-3 text-sm"><b>{rental.deposit?.status ?? (Number(rental.pricing.depositAmount) === 0 ? "ไม่ใช้เงินประกัน" : "ยังไม่มี payment")}</b></p>{rental.deposit?.provider && <p className="mt-1 text-xs text-neutral-500">Provider: {rental.deposit.provider}</p>}{rental.deposit?.resolution && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">{rental.deposit.resolution}</p>}</section>
          {!rental.pricing.isUrgent && <section className="rounded-3xl border bg-white p-6"><h2 className="text-xl font-black">Settlement ผู้ให้ยืม</h2><p className="mt-3 text-sm font-black">{rental.settlement?.status ?? "ยังไม่พร้อม"}</p>{rental.settlement?.payoutAmount && <p className="mt-1 text-sm text-neutral-500">ยอด payout ฿{money.format(Number(rental.settlement.payoutAmount))}</p>}<p className="mt-2 text-xs leading-5 text-neutral-500">READY_FOR_PAYOUT ไม่ได้แปลว่าโอนธนาคารแล้ว ระบบจะถือว่า PAID_OUT เมื่อมี provider/operation reference จริงเท่านั้น</p></section>}
          <section className="rounded-3xl border bg-white p-6"><h2 className="text-xl font-black">สถานที่โดยประมาณ</h2><p className="mt-3 text-sm text-neutral-600">{[rental.approximateLocation.subdistrict, rental.approximateLocation.district, rental.approximateLocation.province].filter(Boolean).join(" · ")}</p>{rental.approximateLocation.label && <p className="mt-1 text-xs text-neutral-400">{rental.approximateLocation.label}</p>}</section>
        </div>
      </div>
    </div>
  </main>;
}
