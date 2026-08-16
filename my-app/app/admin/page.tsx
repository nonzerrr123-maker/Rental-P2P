"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type RequestStatus = "PENDING" | "VERIFIED" | "REJECTED";

type VerificationRequest = {
  id: string;
  userId: string;
  name: string;
  email: string;
  provider: string;
  submittedAt: string;
  reviewedAt: string | null;
  status: RequestStatus;
  rejectionReason: string | null;
};

type QueueCounts = {
  pending: number;
  verified: number;
  rejected: number;
};

export default function AdminPage() {
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [counts, setCounts] = useState<QueueCounts>({ pending: 0, verified: 0, rejected: 0 });
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/verifications", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setMessage(result.message ?? "ไม่สามารถโหลดคิว Verification ได้");
        return;
      }

      setCounts(result.counts);
      setRequests(
        result.requests.map((request: {
          id: string;
          userId: string;
          email: string;
          displayName: string;
          provider: string;
          submittedAt: string;
          reviewedAt: string | null;
          status: RequestStatus;
          rejectionReason: string | null;
        }) => ({
          id: request.id,
          userId: request.userId,
          name: request.displayName,
          email: request.email,
          provider: request.provider,
          submittedAt: request.submittedAt,
          reviewedAt: request.reviewedAt,
          status: request.status,
          rejectionReason: request.rejectionReason,
        })),
      );
      setMessage("");
    } catch {
      setMessage("ไม่สามารถเชื่อมต่อ Verification API ได้");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const review = async (id: string, decision: "VERIFIED" | "REJECTED") => {
    const rejectionReason = rejectionReasons[id]?.trim();
    if (decision === "REJECTED" && !rejectionReason) {
      setMessage("กรุณาระบุเหตุผลก่อน Reject");
      return;
    }

    setWorkingId(id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/verifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, rejectionReason }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setMessage(result.message ?? "ดำเนินการ Verification ไม่สำเร็จ");
        return;
      }
      setRejectionReasons((current) => ({ ...current, [id]: "" }));
      await loadQueue();
    } catch {
      setMessage("ไม่สามารถอัปเดต Verification ได้");
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-10 text-black sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-bold tracking-[3px] text-[#B08D18]">ADMIN CONSOLE</p>
            <h1 className="mt-2 text-4xl font-black">Rental-P2P Admin</h1>
            <p className="mt-2 text-gray-500">Verification queue ใช้ข้อมูลจาก PostgreSQL จริงและบันทึก audit ทุกการตัดสินใจ</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard" className="rounded-lg border bg-white px-4 py-2 text-sm font-bold hover:border-[#D4AF37]">Dashboard</Link>
            <Link href="/rent" className="rounded-lg border bg-white px-4 py-2 text-sm font-bold hover:border-[#D4AF37]">ยืมของ</Link>
            <Link href="/lend" className="rounded-lg bg-[#D4AF37] px-4 py-2 text-sm font-bold">+ ลงของให้ยืม</Link>
            <Link href="/" className="rounded-lg bg-black px-4 py-2 text-sm font-bold text-white">หน้าหลัก</Link>
          </div>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          <div className="rounded-2xl border bg-white p-6"><p className="text-sm text-gray-500">รอตรวจสอบ</p><p className="mt-2 text-4xl font-black text-[#B08D18]">{counts.pending}</p></div>
          <div className="rounded-2xl border bg-white p-6"><p className="text-sm text-gray-500">ยืนยันแล้ว</p><p className="mt-2 text-4xl font-black">{counts.verified}</p></div>
          <div className="rounded-2xl border bg-white p-6"><p className="text-sm text-gray-500">ปฏิเสธ</p><p className="mt-2 text-4xl font-black">{counts.rejected}</p></div>
        </div>

        {message && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{message}</div>}

        <section className="mt-8 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div><h2 className="text-xl font-bold">Verification Requests</h2><p className="mt-1 text-sm text-gray-500">Manual Admin Review fallback — provider KYC จะเชื่อมใน TASK 7</p></div>
              <button onClick={() => void loadQueue()} disabled={loading} className="rounded-lg border px-4 py-2 text-sm font-bold disabled:opacity-50">รีเฟรช</button>
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-gray-500">กำลังโหลดคิว...</div>
          ) : requests.length === 0 ? (
            <div className="p-10 text-center text-gray-500">ยังไม่มีคำขอยืนยันตัวตน</div>
          ) : (
            <div className="divide-y">
              {requests.map((request) => (
                <div key={request.id} className="p-5 sm:p-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="font-bold">{request.name}</h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${request.status === "PENDING" ? "bg-yellow-100 text-yellow-800" : request.status === "VERIFIED" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{request.status}</span>
                      </div>
                      <p className="mt-2 break-all text-sm text-gray-500">{request.email}</p>
                      <p className="mt-1 text-xs leading-5 text-gray-400">Request {request.id} · Provider {request.provider} · ส่ง {new Date(request.submittedAt).toLocaleString("th-TH")}</p>
                      {request.rejectionReason && <p className="mt-2 text-sm text-red-600">เหตุผล: {request.rejectionReason}</p>}
                    </div>

                    {request.status === "PENDING" ? (
                      <div className="w-full max-w-xl lg:w-[440px]">
                        <textarea
                          value={rejectionReasons[request.id] ?? ""}
                          onChange={(event) => setRejectionReasons((current) => ({ ...current, [request.id]: event.target.value }))}
                          placeholder="เหตุผลกรณี Reject..."
                          className="min-h-20 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[#D4AF37]"
                        />
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                          <button
                            disabled={workingId === request.id}
                            onClick={() => void review(request.id, "REJECTED")}
                            className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            Reject
                          </button>
                          <button
                            disabled={workingId === request.id}
                            onClick={() => void review(request.id, "VERIFIED")}
                            className="rounded-lg bg-black px-4 py-2.5 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50"
                          >
                            {workingId === request.id ? "กำลังบันทึก..." : "Verify"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">ดำเนินการแล้ว</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="mt-6 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 p-5 text-sm leading-6 text-gray-700">
          <strong>Fallback พร้อมใช้:</strong> หาก external KYC provider ยังไม่พร้อม Admin/Superadmin สามารถอนุมัติคำขอนี้ได้ และสถานะ VERIFIED จะปลดล็อกสิทธิ์ Rental จาก server authorization ทันที
        </div>
      </div>
    </main>
  );
}
