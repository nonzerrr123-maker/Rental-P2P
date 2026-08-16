"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type VerificationStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";

type VerificationRecord = {
  id: string;
  provider: string;
  status: Exclude<VerificationStatus, "UNVERIFIED">;
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  metadata: Record<string, unknown>;
};

type ProviderState = {
  mode: "PERSONA" | "MANUAL_ADMIN";
  ready: boolean;
  reason: "CONFIGURED" | "MANUAL_MODE" | "PERSONA_CONFIG_INCOMPLETE";
};

type VerificationOverview = {
  verificationStatus: VerificationStatus;
  latest: VerificationRecord | null;
  provider: ProviderState;
};

async function fetchOverview(): Promise<VerificationOverview> {
  const response = await fetch("/api/verification", { cache: "no-store" });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.message ?? "ไม่สามารถโหลดสถานะการยืนยันตัวตนได้");
  }
  return {
    verificationStatus: result.verificationStatus,
    latest: result.latest,
    provider: result.provider,
  };
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
    try {
      setOverview(await fetchOverview());
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ไม่สามารถเชื่อมต่อระบบยืนยันตัวตนได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    void fetchOverview()
      .then((nextOverview) => {
        if (!active) return;
        setOverview(nextOverview);
        setMessage("");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "ไม่สามารถเชื่อมต่อระบบยืนยันตัวตนได้");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const submit = async () => {
    if (overview?.provider.mode === "PERSONA" && !consent) {
      setMessage("กรุณายอมรับการส่งข้อมูลให้ผู้ให้บริการยืนยันตัวตนก่อนเริ่ม KYC");
      return;
    }

    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setMessage(result.message ?? "ส่งคำขอยืนยันตัวตนไม่สำเร็จ");
        return;
      }

      if (result.mode === "PERSONA" && typeof result.redirectUrl === "string") {
        window.location.href = result.redirectUrl;
        return;
      }

      if (result.fallbackReason === "PERSONA_START_FAILED") {
        setMessage("Persona เริ่มทำงานไม่สำเร็จ ระบบจึงส่งคำขอให้ Admin/Superadmin ตรวจแบบ Manual แทนแล้ว");
      } else if (result.fallbackReason === "PERSONA_CONFIG_INCOMPLETE") {
        setMessage("Persona ยังตั้งค่าไม่ครบ ระบบจึงใช้ Manual Admin Review ชั่วคราว");
      }
      await loadOverview();
    } catch {
      setMessage("ไม่สามารถเริ่มระบบยืนยันตัวตนได้");
    } finally {
      setSubmitting(false);
    }
  };

  const resume = async () => {
    setResuming(true);
    setMessage("");
    try {
      const response = await fetch("/api/verification/resume", { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setMessage(result.message ?? "ไม่สามารถเปิด KYC ต่อได้");
        return;
      }
      if (typeof result.redirectUrl === "string") {
        window.location.href = result.redirectUrl;
      }
    } catch {
      setMessage("ไม่สามารถเปิด Persona KYC ต่อได้");
    } finally {
      setResuming(false);
    }
  };

  const status = overview?.verificationStatus;
  const latest = overview?.latest;
  const personaReady = overview?.provider.mode === "PERSONA";
  const pendingPersona = status === "PENDING" && latest?.provider === "PERSONA";

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-12 text-black sm:px-6 sm:py-16">
      <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-6 shadow-sm sm:p-8 md:p-10">
        <p className="text-sm font-bold tracking-[3px] text-[#B08D18]">TRUST & SAFETY</p>
        <h1 className="mt-3 text-3xl font-black">ยืนยันตัวตน</h1>
        <p className="mt-3 leading-7 text-gray-500">
          ต้องยืนยันตัวตนก่อนลงของหรือส่งคำขอยืม สถานะสิทธิ์ทั้งหมดอ้างอิงจาก PostgreSQL ฝั่ง server
        </p>

        {!loading && overview && (
          <div className={`mt-6 rounded-xl border p-4 text-sm ${personaReady ? "border-green-200 bg-green-50 text-green-900" : "border-[#D4AF37]/40 bg-[#fffaf0] text-gray-700"}`}>
            <b>{personaReady ? "Persona KYC พร้อมใช้งาน" : "Manual Admin Review"}</b>
            <p className="mt-1 leading-6">
              {personaReady
                ? "ระบบจะพาไป Hosted Flow ของ Persona เพื่อทำ Government ID + Selfie/Liveness ตาม Inquiry Template ที่ตั้งค่าไว้"
                : overview.provider.reason === "PERSONA_CONFIG_INCOMPLETE"
                  ? "ตั้งค่า Persona ยังไม่ครบ จึงเปิด fallback ให้ Admin/Superadmin อนุมัติแทนโดยอัตโนมัติ"
                  : "ขณะนี้ใช้ Admin/Superadmin ตรวจและอนุมัติคำขอโดยตรง"}
            </p>
          </div>
        )}

        {loading ? (
          <div className="mt-8 rounded-xl border bg-gray-50 p-8 text-center text-gray-500">กำลังโหลดสถานะ...</div>
        ) : status === "VERIFIED" ? (
          <section className="mt-8 rounded-xl border border-green-200 bg-green-50 p-8 text-center">
            <div className="text-5xl">✅</div>
            <h2 className="mt-4 text-xl font-black text-green-900">ยืนยันตัวตนแล้ว</h2>
            <p className="mt-2 text-sm leading-6 text-green-800">บัญชีนี้สามารถลงของและส่งคำขอยืมได้แล้ว</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/rent" className="rounded-lg border border-green-300 bg-white px-5 py-3 font-bold">ค้นหาของ</Link>
              <Link href="/lend" className="rounded-lg bg-black px-5 py-3 font-bold text-white">ลงของให้ยืม</Link>
            </div>
          </section>
        ) : status === "PENDING" ? (
          <section className="mt-8 rounded-xl border border-[#D4AF37] bg-[#fffaf0] p-8 text-center">
            <div className="text-5xl">⏳</div>
            <h2 className="mt-4 text-xl font-black">กำลังรอตรวจสอบ</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              คำขออยู่ในสถานะ <b>PENDING</b> ผ่าน {latest?.provider === "PERSONA" ? "Persona" : "Manual Admin Review"}
            </p>
            {latest?.submittedAt && (
              <p className="mt-3 text-xs text-gray-500">ส่งเมื่อ {new Date(latest.submittedAt).toLocaleString("th-TH")}</p>
            )}
            {pendingPersona && (
              <button
                disabled={resuming}
                onClick={() => void resume()}
                className="mt-5 rounded-lg bg-black px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {resuming ? "กำลังเปิด Persona..." : "ทำ Persona KYC ต่อ"}
              </button>
            )}
            <p className="mt-4 text-xs leading-5 text-gray-500">
              หาก provider ใช้งานไม่ได้ Admin/Superadmin ยังสามารถตรวจและตัดสินคำขอ PENDING นี้ได้จาก Admin Console
            </p>
          </section>
        ) : (
          <section className="mt-8 rounded-xl border border-gray-200 p-6 sm:p-8">
            {status === "REJECTED" ? (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <b>คำขอก่อนหน้าถูกปฏิเสธ</b>
                <p className="mt-1">{latest?.rejectionReason ?? "กรุณาตรวจสอบข้อมูลและส่งคำขอใหม่"}</p>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-gray-50 p-4"><b>01</b><p className="mt-2 text-sm">เริ่ม KYC</p></div>
              <div className="rounded-xl bg-gray-50 p-4"><b>02</b><p className="mt-2 text-sm">ตรวจบัตร + ใบหน้า</p></div>
              <div className="rounded-xl bg-gray-50 p-4"><b>03</b><p className="mt-2 text-sm">ปลดล็อกการยืม</p></div>
            </div>

            <h2 className="mt-7 text-xl font-black">{personaReady ? "Persona Identity Verification" : "Manual verification workflow"}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              {personaReady
                ? "ข้อมูลเอกสารและข้อมูลใบหน้าจะถูกส่งตรงไปยัง Persona ตาม flow ที่ตั้งค่า แอปของเราเก็บเพียง provider reference, สถานะ และ audit metadata ขั้นต่ำ"
                : "ระบบจะสร้างคำขอในฐานข้อมูลและส่งให้ Admin/Superadmin ตรวจสอบ เพื่อไม่ให้ external KYC ที่ยังไม่พร้อมบล็อกการใช้งาน MVP"}
            </p>

            {personaReady && (
              <label className="mt-5 flex items-start gap-3 rounded-lg border bg-gray-50 p-4 text-sm leading-6">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  className="mt-1 h-4 w-4"
                />
                <span>
                  ฉันยินยอมให้ส่งข้อมูลที่จำเป็นสำหรับการยืนยันตัวตนไปยัง Persona รวมถึงข้อมูลจากเอกสารราชการและข้อมูลใบหน้า/liveness ตาม KYC flow
                </span>
              </label>
            )}

            <button
              disabled={submitting || (personaReady && !consent)}
              onClick={() => void submit()}
              className="mt-6 w-full rounded-lg bg-[#D4AF37] px-6 py-3.5 font-black text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? "กำลังเริ่มยืนยันตัวตน..."
                : personaReady
                  ? "เริ่ม Persona KYC"
                  : status === "REJECTED"
                    ? "ส่งคำขอใหม่"
                    : "ส่งคำขอให้ Admin ตรวจ"}
            </button>
          </section>
        )}

        {message && <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{message}</p>}

        <div className="mt-8 rounded-lg bg-gray-50 p-4 text-xs leading-6 text-gray-500">
          ความเป็นส่วนตัว: PostgreSQL ของแอปไม่เก็บภาพบัตรประชาชนหรือข้อมูลชีวมิติแบบ raw และ webhook audit จะไม่เก็บ payload ที่มี PII โดยตรง
        </div>
      </div>
    </main>
  );
}
