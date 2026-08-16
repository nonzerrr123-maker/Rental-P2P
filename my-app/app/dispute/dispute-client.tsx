"use client";

import Link from "next/link";
import { useState } from "react";
import type { DisputeSummary } from "@/lib/rental/disputes";

const reasons = ["ของเสียหาย", "ของไม่ตรงกับประกาศ", "ไม่คืนของ", "คืนล่าช้า", "ปัญหาเงินประกัน", "ปัญหาการส่งมอบ", "ปัญหาอื่น ๆ"];

function EvidenceList({ dispute }: { dispute: DisputeSummary }) {
  return <div className="mt-4 flex flex-wrap gap-2">{dispute.evidence.map((evidence, index) => <a key={evidence.id} target="_blank" rel="noreferrer" href={`/api/disputes/${dispute.id}/evidence/${evidence.id}/content`} className="rounded-lg border px-3 py-2 text-xs font-bold hover:border-[#c9a227]">หลักฐาน {index + 1} · {evidence.submittedBy.displayName}</a>)}</div>;
}

export default function DisputeClient({ rentalRequestId, itemTitle, initialDispute }: { rentalRequestId: string; itemTitle: string; initialDispute: DisputeSummary | null }) {
  const [dispute, setDispute] = useState(initialDispute);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [evidenceDescription, setEvidenceDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const open = async () => {
    setBusy(true); setError("");
    try {
      const form = new FormData();
      form.set("rentalRequestId", rentalRequestId); form.set("reason", reason); form.set("details", details);
      files.forEach((file) => form.append("files", file));
      const response = await fetch("/api/disputes", { method: "POST", body: form });
      const payload = await response.json() as { ok?: boolean; dispute?: DisputeSummary; message?: string };
      if (!response.ok || !payload.ok || !payload.dispute) throw new Error(payload.message || "เปิดข้อพิพาทไม่สำเร็จ");
      setDispute(payload.dispute); setFiles([]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ"); }
    finally { setBusy(false); }
  };

  const addEvidence = async () => {
    if (!dispute) return;
    setBusy(true); setError("");
    try {
      const form = new FormData(); form.set("description", evidenceDescription); evidenceFiles.forEach((file) => form.append("files", file));
      const response = await fetch(`/api/disputes/${dispute.id}/evidence`, { method: "POST", body: form });
      const payload = await response.json() as { ok?: boolean; dispute?: DisputeSummary; message?: string };
      if (!response.ok || !payload.ok || !payload.dispute) throw new Error(payload.message || "เพิ่มหลักฐานไม่สำเร็จ");
      setDispute(payload.dispute); setEvidenceFiles([]); setEvidenceDescription("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ"); }
    finally { setBusy(false); }
  };

  return <main className="min-h-screen bg-[#f7f7f5] text-neutral-950"><header className="border-b bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5"><Link href="/" className="text-2xl font-black">Borow Borow<span className="text-[#c9a227]">.</span></Link><Link href={`/rental/${rentalRequestId}`} className="rounded-xl border px-4 py-2 text-sm font-bold">กลับ Rental</Link></div></header><div className="mx-auto max-w-2xl px-6 py-12"><section className="rounded-3xl border bg-white p-8 shadow-sm"><p className="text-xs font-black tracking-[0.25em] text-[#9d7d13]">DISPUTE CENTER</p><h1 className="mt-3 text-3xl font-black">แจ้งปัญหารายการยืม</h1><p className="mt-2 text-neutral-500">{itemTitle} · {rentalRequestId.slice(0, 8)}</p>
    {dispute ? <div className="mt-8"><div className={`rounded-2xl p-5 ${["OPEN","UNDER_REVIEW"].includes(dispute.status) ? "bg-amber-50 text-amber-900" : "bg-green-50 text-green-800"}`}><div className="flex flex-wrap items-center justify-between gap-2"><b>{dispute.reason}</b><span className="rounded-full bg-white/70 px-3 py-1 text-xs font-black">{dispute.status}</span></div>{dispute.details && <p className="mt-3 text-sm leading-6">{dispute.details}</p>}{dispute.resolutionNotes && <p className="mt-3 border-t border-current/10 pt-3 text-sm font-bold">ผล: {dispute.resolutionNotes}</p>}</div><EvidenceList dispute={dispute} />{["OPEN","UNDER_REVIEW"].includes(dispute.status) && <div className="mt-6 rounded-2xl border p-5"><h2 className="font-black">เพิ่มหลักฐาน</h2><textarea value={evidenceDescription} onChange={(e) => setEvidenceDescription(e.target.value)} maxLength={3000} placeholder="อธิบายหลักฐานเพิ่มเติม" className="mt-3 min-h-24 w-full rounded-xl border bg-neutral-50 p-3 text-sm" /><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setEvidenceFiles(Array.from(e.target.files ?? []).slice(0,6))} className="mt-3 block w-full text-sm" /><button type="button" disabled={!evidenceFiles.length || busy} onClick={() => void addEvidence()} className="mt-4 w-full rounded-xl bg-neutral-950 px-4 py-3 text-sm font-black text-white disabled:opacity-30">เพิ่มหลักฐาน</button></div>}</div> : <div className="mt-8"><label className="text-sm font-bold">สาเหตุ<select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-2 w-full rounded-2xl border bg-white px-4 py-3"><option value="">เลือกสาเหตุ</option>{reasons.map((item) => <option key={item}>{item}</option>)}</select></label><label className="mt-5 block text-sm font-bold">รายละเอียด<textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={3000} rows={6} placeholder="อธิบายปัญหาและสิ่งที่ต้องการให้ตรวจสอบ" className="mt-2 w-full rounded-2xl border bg-neutral-50 p-4 outline-none focus:border-[#c9a227]" /></label><label className="mt-5 block text-sm font-bold">หลักฐาน (ไม่บังคับ)<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0,6))} className="mt-2 block w-full text-sm" /></label><p className="mt-2 text-xs text-neutral-500">สูงสุด 6 รูป · JPEG/PNG/WebP · ไม่เกิน 5MB/รูป</p><button type="button" disabled={!reason || busy} onClick={() => void open()} className="mt-5 w-full rounded-2xl bg-neutral-950 px-5 py-4 font-black text-white disabled:opacity-30">{busy ? "กำลังส่ง..." : "เปิดข้อพิพาทและ freeze รายการ"}</button></div>}{error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}</section></div></main>;
}
