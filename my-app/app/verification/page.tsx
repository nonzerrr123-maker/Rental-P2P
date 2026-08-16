"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type VerificationStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";

type VerificationRecord = {
  id: string;
  provider: string;
  status: Exclude<VerificationStatus, "UNVERIFIED">;
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
};

type VerificationOverview = {
  verificationStatus: VerificationStatus;
  latest: VerificationRecord | null;
};

export default function VerificationPage() {
  const [overview, setOverview] = useState<VerificationOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/verification", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setMessage(result.message ?? "ไม่สามารถโหลดสถานะการยืนยันตัวตนได้");
        return;
      }
      setOverview({
        verificationStatus: result.verificationStatus,
        latest: result.latest,
      });
      setMessage("");
    } catch {
      setMessage("ไม่สามารถเชื่อมต่อระบบยืนยันตัวตนได้");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const submit = async () => {
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/verification", { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setMessage(result.message ?? "ส่งคำขอยืนยันตัวตนไม่สำเร็จ");
        return;
      }
      await loadOverview();
    } catch {
      setMessage("ไม่สามารถส่งคำขอยืนยันตัวตนได้");
    } finally {
      setSubmitting(false);
    }
  };

  const status = overview?.verificationStatus;
  const latest = overview?.latest;

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-12 text-black sm:px-6 sm:py-16">
      <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-6 shadow-sm sm:p-8 md:p-10">
        <p className="text-sm font-bold tracking-[3px] text-[#B08D18]">TRUST & SAFETY</p>
        <h1 className="mt-3 text-3xl font-black">ยืนยันตัวตน</h1>
        <p className="mt-3 leading-7 text-gray-500">
          บัญชีผู้ใช้ต้องผ่านการยืนยันก่อนลงของหรือส่งคำขอยืม ระบบจะใช้สถานะจาก PostgreSQL เป็นแหล่งข้อมูลจริง
        </p>

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
              คำขออยู่ในสถานะ <b>PENDING</b> และไม่สามารถส่งซ้ำได้จนกว่า Admin จะตรวจเสร็จ
            </p>
            {latest?.submittedAt && (
              <p className="mt-3 text-xs text-gray-500">ส่งเมื่อ {new Date(latest.submittedAt).toLocaleString("th-TH")}</p>
            )}
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
              <div className="rounded-xl bg-gray-50 p-4"><b>01</b><p className="mt-2 text-sm">ส่งคำขอ</p></div>
              <div className="rounded-xl bg-gray-50 p-4"><b>02</b><p className="mt-2 text-sm">Admin ตรวจสอบ</p></div>
              <div className="rounded-xl bg-gray-50 p-4"><b>03</b><p className="mt-2 text-sm">ปลดล็อกการยืม</p></div>
            </div>

            <h2 className="mt-7 text-xl font-black">Manual verification workflow</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              ในขั้นนี้ระบบจะสร้างคำขอในฐานข้อมูลและส่งให้ Admin/Superadmin ตรวจสอบ โดยยังไม่รับหรือเก็บรูปบัตรประชาชนและข้อมูลใบหน้าในแอป การตรวจเอกสารและ liveness ผ่าน KYC provider จะเชื่อมในขั้นถัดไป
            </p>
            <button
              disabled={submitting}
              onClick={submit}
              className="mt-6 w-full rounded-lg bg-[#D4AF37] px-6 py-3.5 font-black text-black disabled:opacity-50"
            >
              {submitting ? "กำลังส่งคำขอ..." : status === "REJECTED" ? "ส่งคำขอใหม่" : "ส่งคำขอยืนยันตัวตน"}
            </button>
          </section>
        )}

        {message && <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{message}</p>}

        <div className="mt-8 rounded-lg bg-gray-50 p-4 text-xs leading-6 text-gray-500">
          ความเป็นส่วนตัว: ฐานข้อมูลแอปจะไม่เก็บภาพบัตรประชาชนหรือข้อมูลชีวมิติแบบ raw การเชื่อม KYC provider จะเก็บเฉพาะ reference และข้อมูล audit ที่จำเป็นเท่านั้น
        </div>
      </div>
    </main>
  );
}
