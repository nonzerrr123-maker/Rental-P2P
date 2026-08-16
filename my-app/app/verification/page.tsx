"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/site-header";
import { CheckIcon, ClockIcon, ShieldCheckIcon } from "@/components/ui/icons";
import { SectionEyebrow, StatusPill } from "@/components/ui/primitives";

type VerificationStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
type VerificationRecord = { id: string; provider: string; status: Exclude<VerificationStatus, "UNVERIFIED">; submittedAt: string; reviewedAt: string | null; rejectionReason: string | null; metadata: Record<string, unknown> };
type ProviderState = { mode: "PERSONA" | "MANUAL_ADMIN"; ready: boolean; reason: "CONFIGURED" | "MANUAL_MODE" | "PERSONA_CONFIG_INCOMPLETE" };
type VerificationOverview = { verificationStatus: VerificationStatus; latest: VerificationRecord | null; provider: ProviderState };

async function fetchOverview(): Promise<VerificationOverview> {
  const response = await fetch("/api/verification", { cache: "no-store" });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.message ?? "ไม่สามารถโหลดสถานะการยืนยันตัวตนได้");
  return { verificationStatus: result.verificationStatus, latest: result.latest, provider: result.provider };
}

export default function VerificationPage() {
  const [overview, setOverview] = useState<VerificationOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState("");

  const loadOverview = async () => {
    setLoading(true);
    try { setOverview(await fetchOverview()); setMessage(""); }
    catch (error) { setMessage(error instanceof Error ? error.message : "ไม่สามารถเชื่อมต่อระบบยืนยันตัวตนได้"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    let active = true;
    void fetchOverview().then((next) => { if (active) { setOverview(next); setMessage(""); } }).catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : "ไม่สามารถเชื่อมต่อระบบยืนยันตัวตนได้"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const submit = async () => {
    if (overview?.provider.mode === "PERSONA" && !consent) { setMessage("กรุณายอมรับการส่งข้อมูลให้ผู้ให้บริการยืนยันตัวตนก่อนเริ่ม KYC"); return; }
    setSubmitting(true); setMessage("");
    try {
      const response = await fetch("/api/verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consent }) });
      const result = await response.json();
      if (!response.ok || !result.ok) { setMessage(result.message ?? "ส่งคำขอยืนยันตัวตนไม่สำเร็จ"); return; }
      if (result.mode === "PERSONA" && typeof result.redirectUrl === "string") { window.location.href = result.redirectUrl; return; }
      if (result.fallbackReason === "PERSONA_START_FAILED") setMessage("Persona เริ่มทำงานไม่สำเร็จ ระบบส่งคำขอให้ผู้ดูแลตรวจแบบ Manual แทนแล้ว");
      else if (result.fallbackReason === "PERSONA_CONFIG_INCOMPLETE") setMessage("Persona ยังตั้งค่าไม่ครบ ระบบใช้ Manual Review ชั่วคราว");
      await loadOverview();
    } catch { setMessage("ไม่สามารถเริ่มระบบยืนยันตัวตนได้"); }
    finally { setSubmitting(false); }
  };

  const resume = async () => {
    setResuming(true); setMessage("");
    try {
      const response = await fetch("/api/verification/resume", { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.ok) { setMessage(result.message ?? "ไม่สามารถเปิด KYC ต่อได้"); return; }
      if (typeof result.redirectUrl === "string") window.location.href = result.redirectUrl;
    } catch { setMessage("ไม่สามารถเปิด Persona KYC ต่อได้"); }
    finally { setResuming(false); }
  };

  const status = overview?.verificationStatus;
  const latest = overview?.latest;
  const personaReady = overview?.provider.mode === "PERSONA";
  const pendingPersona = status === "PENDING" && latest?.provider === "PERSONA";

  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <SectionEyebrow>Trust & safety</SectionEyebrow>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] sm:text-4xl">ยืนยันตัวตนก่อนเริ่มยืม</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">KYC ช่วยให้คนสองฝั่งรู้ว่ากำลังทำรายการกับบัญชีที่ผ่านการตรวจจริง โดยแอปไม่เก็บภาพบัตรหรือข้อมูลชีวมิติแบบ raw</p>

        <section className="mt-7 overflow-hidden rounded-[28px] border border-[var(--line)] bg-white shadow-[var(--shadow-soft)]">
          <div className="border-b border-[var(--line)] p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--gold-soft)] text-[var(--gold-strong)]"><ShieldCheckIcon size={22}/></span><div><p className="text-xs font-bold text-[var(--muted)]">สถานะบัญชี</p><p className="mt-1 font-black">{loading ? "กำลังตรวจสอบ..." : status ?? "ไม่ทราบสถานะ"}</p></div></div>{status && <StatusPill tone={status === "VERIFIED" ? "success" : status === "REJECTED" ? "danger" : "gold"}>{status}</StatusPill>}</div>
          </div>

          {loading ? <div className="p-8 text-sm text-[var(--muted)]">กำลังโหลดสถานะ...</div> : status === "VERIFIED" ? (
            <div className="p-6 text-center sm:p-8"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-700"><CheckIcon size={26}/></div><h2 className="mt-4 text-xl font-black">ยืนยันตัวตนแล้ว</h2><p className="mt-2 text-sm text-[var(--muted)]">บัญชีนี้พร้อมยืมของ ปล่อยของ และส่งข้อเสนอใน Community</p><div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row"><Link href="/rent" className="rounded-xl border border-[var(--line)] px-5 py-3 text-sm font-black">ค้นหาของ</Link><Link href="/lend" className="rounded-xl bg-[var(--ink)] px-5 py-3 text-sm font-black text-white">ลงของให้ยืม</Link></div></div>
          ) : status === "PENDING" ? (
            <div className="p-6 sm:p-8"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--gold-soft)] text-[var(--gold-strong)]"><ClockIcon size={21}/></span><div><h2 className="font-black">กำลังรอตรวจสอบ</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">คำขอถูกส่งผ่าน {latest?.provider === "PERSONA" ? "Persona" : "Manual Admin Review"}{latest?.submittedAt ? ` เมื่อ ${new Date(latest.submittedAt).toLocaleString("th-TH")}` : ""}</p></div></div>{pendingPersona && <button disabled={resuming} onClick={() => void resume()} className="mt-5 w-full rounded-xl bg-[var(--ink)] px-5 py-3 text-sm font-black text-white disabled:opacity-50">{resuming ? "กำลังเปิด Persona..." : "ทำ Persona KYC ต่อ"}</button>}</div>
          ) : (
            <div className="p-5 sm:p-7">
              {status === "REJECTED" && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><b>คำขอก่อนหน้าถูกปฏิเสธ</b><p className="mt-1">{latest?.rejectionReason ?? "ตรวจสอบข้อมูลแล้วส่งคำขอใหม่ได้"}</p></div>}
              <div className="grid gap-3 sm:grid-cols-3">{[["01","เริ่ม KYC"],["02","ตรวจเอกสาร/ใบหน้า"],["03","ปลดล็อกการใช้งาน"]].map(([number,label]) => <div key={number} className="rounded-2xl bg-[var(--surface-2)] p-4"><span className="text-xs font-black text-[var(--gold-strong)]">{number}</span><p className="mt-2 text-sm font-bold">{label}</p></div>)}</div>
              <div className="mt-6 rounded-2xl border border-[var(--line)] p-4"><p className="font-black">{personaReady ? "Persona Identity Verification" : "Manual verification"}</p><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{personaReady ? "ข้อมูลที่จำเป็นถูกส่งตรงไปยัง Hosted KYC ของ Persona และ Borow Borow เก็บเพียง reference/status/audit metadata ขั้นต่ำ" : "ระบบจะสร้างคำขอให้ Admin/Superadmin ตรวจ เพื่อให้ MVP ใช้งานได้โดยไม่ผูกกับบริการภายนอกที่ยังไม่พร้อม"}</p></div>
              {personaReady && <label className="mt-4 flex items-start gap-3 rounded-2xl bg-[var(--surface-2)] p-4 text-sm leading-6"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-5 w-5 accent-[var(--gold-strong)]"/><span>ฉันยินยอมให้ส่งข้อมูลที่จำเป็นสำหรับ KYC ไปยัง Persona รวมถึงข้อมูลเอกสารราชการและข้อมูลใบหน้า/liveness ตาม flow</span></label>}
              <button disabled={submitting || (personaReady && !consent)} onClick={() => void submit()} className="mt-5 min-h-12 w-full rounded-xl bg-[var(--gold)] px-6 py-3 font-black text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "กำลังเริ่มยืนยันตัวตน..." : personaReady ? "เริ่ม Persona KYC" : status === "REJECTED" ? "ส่งคำขอใหม่" : "ส่งคำขอให้ผู้ดูแลตรวจ"}</button>
            </div>
          )}
        </section>

        {!loading && overview && <p className="mt-4 text-xs leading-5 text-[var(--muted)]">Provider: {personaReady ? "Persona" : "Manual Admin Review"} · สิทธิ์การยืมถูกตรวจซ้ำฝั่ง server ทุกครั้ง</p>}
        {message && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{message}</p>}
      </div>
    </main>
  );
}
