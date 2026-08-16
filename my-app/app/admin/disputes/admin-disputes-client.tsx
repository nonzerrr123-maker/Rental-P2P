"use client";

import Link from "next/link";
import { useState } from "react";
import type { AdminDisputeDetail, DisputeResolution } from "@/lib/rental/disputes";

const resolutions: Array<{ value: DisputeResolution; label: string }> = [
  { value: "NO_FAULT", label: "No fault — คืนเงินประกันให้ผู้ยืม" },
  { value: "REFUND_DEPOSIT_FULL", label: "คืนเงินประกันเต็มจำนวน" },
  { value: "PARTIAL_DEPOSIT_REFUND", label: "คืนเงินประกันบางส่วน" },
  { value: "FORFEIT_DEPOSIT_FULL", label: "ริบเงินประกันเต็มจำนวน" },
  { value: "REJECT_DISPUTE", label: "ปฏิเสธข้อพิพาท" },
];

function DisputeCard({ initial, onUpdated }: { initial: AdminDisputeDetail; onUpdated: (value: AdminDisputeDetail) => void }) {
  const [item, setItem] = useState(initial);
  const [resolution, setResolution] = useState<DisputeResolution>("NO_FAULT");
  const [notes, setNotes] = useState("");
  const [partialRefundAmount, setPartialRefundAmount] = useState("");
  const [manualRefundReference, setManualRefundReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const apply = (updated: AdminDisputeDetail) => { setItem(updated); onUpdated(updated); };
  const start = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/disputes/${item.id}/review`, { method: "POST" });
      const payload = await response.json() as { ok?: boolean; dispute?: AdminDisputeDetail; message?: string };
      if (!response.ok || !payload.ok || !payload.dispute) throw new Error(payload.message || "เริ่มตรวจสอบไม่สำเร็จ");
      apply({ ...item, ...payload.dispute });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ"); }
    finally { setBusy(false); }
  };
  const resolve = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/disputes/${item.id}/resolve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution, notes, partialRefundAmount: partialRefundAmount || undefined, manualRefundReference: manualRefundReference || undefined }),
      });
      const payload = await response.json() as { ok?: boolean; dispute?: AdminDisputeDetail; message?: string; code?: string };
      if (!response.ok || !payload.ok || !payload.dispute) throw new Error(payload.code === "MANUAL_REFUND_REQUIRED" ? `${payload.message} — คืนเงินจริงก่อนแล้วใส่เลขอ้างอิง` : payload.message || "ตัดสินข้อพิพาทไม่สำเร็จ");
      apply(payload.dispute);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ"); }
    finally { setBusy(false); }
  };

  return <article className="rounded-3xl border bg-white p-6 shadow-sm"><div className="flex flex-col justify-between gap-4 lg:flex-row"><div><div className="flex flex-wrap items-center gap-2"><b className="text-xl">{item.itemTitle}</b><span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-black">{item.status}</span><span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">Rental {item.rentalStatus}</span></div><p className="mt-2 text-sm text-neutral-500">{item.borrower.displayName} ↔ {item.lender.displayName} · เปิดโดย {item.openedBy.displayName}</p><p className="mt-4 font-black">{item.reason}</p>{item.details && <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-600">{item.details}</p>}</div><Link href={`/rental/${item.rentalRequestId}`} className="h-fit rounded-xl border px-4 py-2 text-sm font-bold">ดู Rental</Link></div>
    <div className="mt-5 grid gap-3 md:grid-cols-3"><div className="rounded-xl bg-neutral-50 p-4 text-sm"><b>สถานะเดิม</b><p className="mt-1 text-neutral-500">{item.previousRentalStatus ?? "—"}</p></div><div className="rounded-xl bg-neutral-50 p-4 text-sm"><b>เงินประกัน</b><p className="mt-1 text-neutral-500">{item.deposit ? `฿${item.deposit.amount} · ${item.deposit.status} · ${item.deposit.provider ?? "—"}` : "ไม่มี"}</p></div><div className="rounded-xl bg-neutral-50 p-4 text-sm"><b>Settlement</b><p className="mt-1 text-neutral-500">{item.settlement?.status ?? "ไม่มี"}</p></div></div>
    {item.evidence.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{item.evidence.map((evidence, index) => <a key={evidence.id} href={`/api/disputes/${item.id}/evidence/${evidence.id}/content`} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-2 text-xs font-bold">หลักฐาน {index + 1} · {evidence.submittedBy.displayName}</a>)}</div>}
    {item.resolutionNotes && <div className="mt-5 rounded-xl bg-green-50 p-4 text-sm font-bold text-green-800">{item.resolutionNotes}</div>}
    {item.status === "OPEN" && <button type="button" disabled={busy} onClick={() => void start()} className="mt-5 rounded-xl bg-neutral-950 px-5 py-3 text-sm font-black text-white disabled:opacity-40">เริ่มตรวจสอบ</button>}
    {["OPEN","UNDER_REVIEW"].includes(item.status) && <div className="mt-5 rounded-2xl border p-5"><h3 className="font-black">ตัดสินและจัดการเงิน</h3><select value={resolution} onChange={(e) => setResolution(e.target.value as DisputeResolution)} className="mt-3 w-full rounded-xl border bg-white px-4 py-3 text-sm">{resolutions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{resolution === "PARTIAL_DEPOSIT_REFUND" && <input value={partialRefundAmount} onChange={(e) => setPartialRefundAmount(e.target.value)} inputMode="decimal" placeholder="ยอดคืนบางส่วน เช่น 300" className="mt-3 w-full rounded-xl border px-4 py-3 text-sm" />}<input value={manualRefundReference} onChange={(e) => setManualRefundReference(e.target.value)} placeholder="เลขอ้างอิงคืนเงินจริง (จำเป็นสำหรับ provider ที่คืนอัตโนมัติไม่ได้)" className="mt-3 w-full rounded-xl border px-4 py-3 text-sm" /><textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder="เหตุผลการตัดสิน (จำเป็น)" className="mt-3 min-h-24 w-full rounded-xl border bg-neutral-50 p-3 text-sm" /><button type="button" disabled={busy || notes.trim().length < 8} onClick={() => void resolve()} className="mt-3 w-full rounded-xl bg-[#c9a227] px-4 py-3 font-black text-white disabled:opacity-30">บันทึกผลการตัดสิน</button></div>}
    {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}</article>;
}

export default function AdminDisputesClient({ initialItems }: { initialItems: AdminDisputeDetail[] }) {
  const [items, setItems] = useState(initialItems);
  const update = (value: AdminDisputeDetail) => setItems((current) => current.map((item) => item.id === value.id ? value : item));
  const openCount = items.filter((item) => ["OPEN","UNDER_REVIEW"].includes(item.status)).length;
  return <main className="min-h-screen bg-[#f7f7f5] text-neutral-950"><header className="border-b bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5"><Link href="/admin" className="text-2xl font-black">Borow Borow<span className="text-[#c9a227]">.</span></Link><Link href="/admin" className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-bold text-white">Admin</Link></div></header><div className="mx-auto max-w-7xl px-6 py-10"><p className="text-xs font-black tracking-[0.25em] text-[#9d7d13]">ADMIN / DISPUTES</p><h1 className="mt-2 text-4xl font-black">Dispute operations</h1><p className="mt-2 text-neutral-500">หลักฐานจริง, financial freeze และทุกผลตัดสินถูกบันทึกลง PostgreSQL + audit log</p><div className="mt-6 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border bg-white p-5"><p className="text-sm text-neutral-500">รอดำเนินการ</p><b className="mt-2 block text-3xl">{openCount}</b></div><div className="rounded-2xl border bg-white p-5"><p className="text-sm text-neutral-500">ปิดแล้ว</p><b className="mt-2 block text-3xl">{items.length-openCount}</b></div><div className="rounded-2xl border bg-white p-5"><p className="text-sm text-neutral-500">ทั้งหมด</p><b className="mt-2 block text-3xl">{items.length}</b></div></div><div className="mt-6 space-y-5">{items.map((item) => <DisputeCard key={item.id} initial={item} onUpdated={update} />)}{items.length === 0 && <div className="rounded-3xl border bg-white p-12 text-center text-neutral-500">ยังไม่มีข้อพิพาท</div>}</div></div></main>;
}
