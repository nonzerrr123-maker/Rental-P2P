"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CheckoutSummary, PaymentSummary } from "@/lib/payments/service";

const money = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });

const typeLabel: Record<string, string> = {
  RENTAL: "ค่าเช่า",
  DEPOSIT: "เงินประกัน",
  URGENT_RESERVATION_FEE: "ค่าจองยืมด่วน",
  PLATFORM_FEE: "ค่าบริการแพลตฟอร์ม",
  REFUND: "คืนเงิน",
};

function statusClass(status: string): string {
  if (status === "SUCCEEDED") return "bg-green-50 text-green-700";
  if (["FAILED", "CANCELLED"].includes(status)) return "bg-red-50 text-red-700";
  if (status === "REFUNDED") return "bg-blue-50 text-blue-700";
  return "bg-amber-50 text-amber-800";
}

function PaymentCard({ payment, busy, onConfirm }: { payment: PaymentSummary; busy: boolean; onConfirm: (payment: PaymentSummary) => void }) {
  return (
    <article className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-black">{typeLabel[payment.type] ?? payment.type}</p>
          <p className="mt-1 text-2xl font-black">฿{money.format(Number(payment.amount))}</p>
          <p className="mt-1 text-xs text-neutral-400">{payment.provider} · {payment.id.slice(0, 8)}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(payment.status)}`}>{payment.status}</span>
      </div>
      {payment.action.kind === "SANDBOX" && payment.status !== "SUCCEEDED" && (
        <button type="button" disabled={busy} onClick={() => onConfirm(payment)} className="mt-4 w-full rounded-xl bg-neutral-950 px-4 py-3 font-black text-white disabled:opacity-40">
          {busy ? "กำลังยืนยัน..." : "ยืนยันการจ่าย (Sandbox)"}
        </button>
      )}
      {payment.action.kind === "REDIRECT" && payment.action.url && (
        <a href={payment.action.url} className="mt-4 block rounded-xl bg-neutral-950 px-4 py-3 text-center font-black text-white">ไปหน้าชำระเงิน</a>
      )}
      {payment.action.kind === "QR" && payment.action.imageUrl && (
        <div className="mt-4 rounded-xl bg-neutral-50 p-4 text-center"><p className="text-sm font-bold">สแกน QR จากผู้ให้บริการชำระเงิน</p><a href={payment.action.imageUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-black text-[#987914]">เปิด QR</a></div>
      )}
    </article>
  );
}

export default function CheckoutClient({ rentalRequestId, displayName }: { rentalRequestId: string; displayName: string }) {
  const [checkout, setCheckout] = useState<CheckoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const response = await fetch(`/api/payments/checkout?rentalRequestId=${encodeURIComponent(rentalRequestId)}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || "โหลดข้อมูลชำระเงินไม่สำเร็จ");
    setCheckout(payload.checkout as CheckoutSummary);
  };

  useEffect(() => {
    let active = true;
    fetch(`/api/payments/checkout?rentalRequestId=${encodeURIComponent(rentalRequestId)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.message || "โหลดข้อมูลชำระเงินไม่สำเร็จ");
        return payload.checkout as CheckoutSummary;
      })
      .then((data) => { if (active) { setCheckout(data); setError(""); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "โหลดข้อมูลชำระเงินไม่สำเร็จ"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [rentalRequestId]);

  const start = async () => {
    setBusy("start");
    setError("");
    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rentalRequestId, amount: 1, status: "PAID", payerId: "ignored" }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.message || "เริ่มชำระเงินไม่สำเร็จ");
      setCheckout(payload.checkout as CheckoutSummary);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "เริ่มชำระเงินไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  };

  const confirm = async (payment: PaymentSummary) => {
    if (payment.action.kind !== "SANDBOX" || !payment.action.confirmPath) return;
    setBusy(payment.id);
    setError("");
    try {
      const response = await fetch(payment.action.confirmPath, { method: "POST" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.message || "ยืนยันการชำระไม่สำเร็จ");
      setCheckout(payload.checkout as CheckoutSummary);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ยืนยันการชำระไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  };

  const pending = checkout?.payments.filter((payment) => !["SUCCEEDED", "REFUNDED"].includes(payment.status)) ?? [];
  const complete = checkout?.status === "PAID";

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-neutral-950">
      <header className="border-b border-neutral-200 bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5"><Link href="/" className="text-2xl font-black">Borow Borow<span className="text-[#c9a227]">.</span></Link><Link href="/dashboard" className="rounded-xl border px-4 py-2 text-sm font-black">Dashboard</Link></div></header>
      <div className="mx-auto max-w-5xl px-5 py-10">
        <p className="text-xs font-black tracking-[0.22em] text-[#9d7d13]">SECURE CHECKOUT</p>
        <h1 className="mt-2 text-4xl font-black">ชำระเงินการยืม</h1>
        <p className="mt-2 text-neutral-500">ผู้ชำระ: {displayName} · ยอดถูกคำนวณจาก booking snapshot ฝั่ง server เท่านั้น</p>

        {loading && <div className="mt-8 rounded-2xl border bg-white p-8 text-neutral-500">กำลังโหลด...</div>}
        {error && <div className="mt-6 rounded-2xl bg-red-50 p-4 font-semibold text-red-700">{error}</div>}

        {checkout && (
          <>
            <section className="mt-8 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                <div><p className="text-sm text-neutral-500">รายการ</p><h2 className="mt-1 text-2xl font-black">{checkout.item.title}</h2><p className="mt-2 text-sm text-neutral-500">Request {checkout.rentalRequestId}</p></div>
                <div className="text-left sm:text-right"><p className="text-sm text-neutral-500">ยอดที่แพลตฟอร์มเรียกเก็บ</p><p className="mt-1 text-3xl font-black">฿{money.format(Number(checkout.requiredAmount))}</p><p className="mt-1 text-xs text-neutral-400">{checkout.collectionPolicy === "URGENT_PLATFORM_ONLY" ? "ค่าจองด่วน + เงินประกัน" : "ค่าเช่า + เงินประกัน"}</p></div>
              </div>
              {checkout.isUrgent && checkout.reservationExpiresAt && !complete && <p className="mt-5 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">⚡ ต้องชำระก่อน {dateTime.format(new Date(checkout.reservationExpiresAt))}</p>}
              {checkout.deposit && <p className="mt-4 text-sm text-neutral-500">เงินประกัน ฿{money.format(Number(checkout.deposit.amount))} · สถานะ <b>{checkout.deposit.status}</b> — ระบบพักไว้ส่วนกลางก่อน release/refund/forfeit</p>}
            </section>

            {checkout.payments.length === 0 && !complete && (
              <button type="button" disabled={busy === "start"} onClick={() => void start()} className="mt-6 w-full rounded-2xl bg-[#c9a227] px-5 py-4 text-lg font-black text-white disabled:opacity-40">{busy === "start" ? "กำลังสร้างรายการ..." : "เริ่มชำระเงิน"}</button>
            )}

            {checkout.payments.length > 0 && <section className="mt-6 grid gap-4 md:grid-cols-2">{checkout.payments.filter((payment) => payment.type !== "REFUND").map((payment) => <PaymentCard key={payment.id} payment={payment} busy={busy === payment.id} onConfirm={(entry) => void confirm(entry)} />)}</section>}

            {complete && <div className="mt-6 rounded-3xl border border-green-200 bg-green-50 p-6"><p className="text-xl font-black text-green-800">✓ ชำระ obligation ของแพลตฟอร์มครบแล้ว</p><p className="mt-2 text-sm text-green-700">สถานะ rental เปลี่ยนเป็น PAID จาก server หลังตรวจ payment ครบเท่านั้น</p><Link href="/dashboard" className="mt-4 inline-block rounded-xl bg-green-800 px-5 py-3 font-black text-white">กลับ Dashboard</Link></div>}

            {!complete && checkout.payments.length > 0 && pending.length === 0 && <button type="button" onClick={() => void load()} className="mt-6 rounded-xl border px-4 py-3 font-black">รีเฟรชสถานะ</button>}
            {checkout.provider.mode === "SANDBOX" && <p className="mt-6 text-center text-xs text-neutral-400">Sandbox Payment Provider · ไม่มีการตัดเงินจริง · ใช้สำหรับพิสูจน์ state machine ก่อนต่อ provider จริง</p>}
          </>
        )}
      </div>
    </main>
  );
}
