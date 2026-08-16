"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { RentalPricingMode } from "@/lib/rental/bookings";

const money = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type BookingFormProps = {
  itemId: string;
  hourlyRate: string | null;
  dailyRate: string | null;
  minimumHours: number;
  depositAmount: string;
};

type CreatedRequest = {
  id: string;
  status: string;
  rentalAmount: string;
  depositAmount: string;
  durationUnits: string;
  pricingMode: RentalPricingMode;
};

type AvailabilityResponse = {
  ok: boolean;
  availability?: { available: boolean };
  code?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
};

function localDateTimeToIso(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function firstError(payload: AvailabilityResponse): string {
  const fieldError = payload.fieldErrors && Object.values(payload.fieldErrors)[0];
  return fieldError || payload.message || "เกิดข้อผิดพลาด กรุณาลองใหม่";
}

export function BookingForm({
  itemId,
  hourlyRate,
  dailyRate,
  minimumHours,
  depositAmount,
}: BookingFormProps) {
  const initialMode: RentalPricingMode = hourlyRate ? "HOUR" : "DAY";
  const [pricingMode, setPricingMode] = useState<RentalPricingMode>(initialMode);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "unavailable">("idle");
  const [message, setMessage] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedRequest | null>(null);

  const preview = useMemo(() => {
    const start = localDateTimeToIso(startsAt);
    const end = localDateTimeToIso(endsAt);
    if (!start || !end) return null;
    const diff = new Date(end).getTime() - new Date(start).getTime();
    if (diff <= 0) return null;
    const units = pricingMode === "HOUR" ? Math.ceil(diff / HOUR_MS) : Math.ceil(diff / DAY_MS);
    const rate = Number(pricingMode === "HOUR" ? hourlyRate : dailyRate);
    if (!Number.isFinite(rate) || rate <= 0) return null;
    return {
      units,
      rate,
      total: rate * units,
      validMinimum: pricingMode !== "HOUR" || units >= minimumHours,
    };
  }, [startsAt, endsAt, pricingMode, hourlyRate, dailyRate, minimumHours]);

  const resetAvailability = () => {
    setAvailability("idle");
    setMessage("");
    setErrorCode("");
    setCreated(null);
  };

  const fetchAvailability = async (): Promise<boolean> => {
    const start = localDateTimeToIso(startsAt);
    const end = localDateTimeToIso(endsAt);
    if (!start || !end || !preview) {
      setMessage("กรุณาเลือกวันเวลาเริ่มและสิ้นสุดให้ถูกต้อง");
      return false;
    }
    if (!preview.validMinimum) {
      setMessage(`รายการนี้ต้องยืมอย่างน้อย ${minimumHours} ชั่วโมง`);
      return false;
    }

    setAvailability("checking");
    setMessage("");
    setErrorCode("");
    try {
      const params = new URLSearchParams({ from: start, to: end });
      const response = await fetch(`/api/rental-items/${itemId}/availability?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as AvailabilityResponse;
      if (!response.ok || !payload.ok || !payload.availability) {
        setAvailability("idle");
        setErrorCode(payload.code || "");
        setMessage(firstError(payload));
        return false;
      }
      if (!payload.availability.available) {
        setAvailability("unavailable");
        setMessage("ช่วงเวลานี้มีรายการที่ยืนยันแล้วหรือเจ้าของบล็อกเวลาไว้ กรุณาเลือกช่วงอื่น");
        return false;
      }
      setAvailability("available");
      setMessage("ช่วงเวลานี้ยังว่าง สามารถส่งคำขอยืมได้");
      return true;
    } catch {
      setAvailability("idle");
      setMessage("ตรวจสอบเวลาว่างไม่สำเร็จ กรุณาลองใหม่");
      return false;
    }
  };

  const submitRequest = async () => {
    const start = localDateTimeToIso(startsAt);
    const end = localDateTimeToIso(endsAt);
    if (!start || !end || !preview) {
      setMessage("กรุณาเลือกวันเวลาเริ่มและสิ้นสุดให้ถูกต้อง");
      return;
    }
    if (!(await fetchAvailability())) return;

    setSubmitting(true);
    setMessage("");
    setErrorCode("");
    try {
      const response = await fetch("/api/rental-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          pricingMode,
          startsAt: start,
          endsAt: end,
        }),
      });
      const payload = await response.json() as {
        ok: boolean;
        request?: CreatedRequest;
        code?: string;
        message?: string;
        fieldErrors?: Record<string, string>;
      };
      if (!response.ok || !payload.ok || !payload.request) {
        setErrorCode(payload.code || "");
        setMessage(firstError(payload));
        if (payload.code === "AVAILABILITY_CONFLICT") setAvailability("unavailable");
        return;
      }
      setCreated(payload.request);
      setAvailability("available");
      setMessage("");
    } catch {
      setMessage("ส่งคำขอยืมไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
    }
  };

  if (created) {
    return (
      <div className="mt-6 rounded-2xl border border-[#d7bd65] bg-[#fffaf0] p-5">
        <p className="text-sm font-black text-[#7d6310]">ส่งคำขอยืมแล้ว ✓</p>
        <p className="mt-2 text-sm text-neutral-700">สถานะ <b>{created.status}</b> · รอเจ้าของตอบรับ</p>
        <p className="mt-1 text-sm text-neutral-600">ค่าเช่า ฿{money.format(Number(created.rentalAmount))} · เงินประกัน ฿{money.format(Number(created.depositAmount))}</p>
        <Link href="/dashboard" className="mt-4 inline-flex rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-black text-white">
          ดูคำขอของฉัน →
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 border-t border-neutral-200 pt-6">
      <h2 className="font-black">เลือกช่วงเวลายืม</h2>
      <p className="mt-1 text-xs text-neutral-500">ระบบจะคำนวณราคาและตรวจเวลาว่างซ้ำบนเซิร์ฟเวอร์ก่อนสร้างคำขอ</p>

      <div className="mt-4 flex gap-2">
        {hourlyRate && (
          <button
            type="button"
            onClick={() => { setPricingMode("HOUR"); resetAvailability(); }}
            className={`flex-1 rounded-xl border px-4 py-3 text-sm font-black ${pricingMode === "HOUR" ? "border-neutral-950 bg-neutral-950 text-white" : "bg-white"}`}
          >
            รายชั่วโมง
          </button>
        )}
        {dailyRate && (
          <button
            type="button"
            onClick={() => { setPricingMode("DAY"); resetAvailability(); }}
            className={`flex-1 rounded-xl border px-4 py-3 text-sm font-black ${pricingMode === "DAY" ? "border-neutral-950 bg-neutral-950 text-white" : "bg-white"}`}
          >
            รายวัน
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <label className="text-xs font-bold text-neutral-600">
          เริ่มยืม
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(event) => { setStartsAt(event.target.value); resetAvailability(); }}
            className="mt-2 w-full rounded-xl border border-neutral-300 px-3 py-3 text-sm font-normal text-neutral-950"
          />
        </label>
        <label className="text-xs font-bold text-neutral-600">
          คืนของ
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(event) => { setEndsAt(event.target.value); resetAvailability(); }}
            className="mt-2 w-full rounded-xl border border-neutral-300 px-3 py-3 text-sm font-normal text-neutral-950"
          />
        </label>
      </div>

      {preview && (
        <div className="mt-4 rounded-2xl bg-neutral-50 p-4 text-sm">
          <div className="flex justify-between gap-4"><span className="text-neutral-500">ระยะเวลาคิดราคา</span><b>{preview.units} {pricingMode === "HOUR" ? "ชั่วโมง" : "วัน"}</b></div>
          <div className="mt-2 flex justify-between gap-4"><span className="text-neutral-500">ค่าเช่าโดยประมาณ</span><b>฿{money.format(preview.total)}</b></div>
          <div className="mt-2 flex justify-between gap-4"><span className="text-neutral-500">เงินประกัน</span><b>฿{money.format(Number(depositAmount))}</b></div>
          {!preview.validMinimum && <p className="mt-3 text-xs font-bold text-red-600">ขั้นต่ำ {minimumHours} ชั่วโมง</p>}
        </div>
      )}

      {message && (
        <div className={`mt-4 rounded-xl p-3 text-sm font-semibold ${availability === "available" ? "bg-green-50 text-green-700" : availability === "unavailable" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
          {message}
          {errorCode === "UNAUTHENTICATED" && <Link href={`/login?next=${encodeURIComponent(`/rent/${itemId}`)}`} className="ml-2 underline">เข้าสู่ระบบ</Link>}
          {errorCode === "VERIFICATION_REQUIRED" && <Link href="/verification" className="ml-2 underline">ยืนยันตัวตน</Link>}
        </div>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <button
          type="button"
          disabled={!preview || !preview.validMinimum || availability === "checking" || submitting}
          onClick={() => void fetchAvailability()}
          className="rounded-2xl border border-neutral-300 px-4 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          {availability === "checking" ? "กำลังตรวจสอบ..." : "ตรวจสอบเวลาว่าง"}
        </button>
        <button
          type="button"
          disabled={!preview || !preview.validMinimum || submitting || availability === "checking"}
          onClick={() => void submitRequest()}
          className="rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "กำลังส่งคำขอ..." : "ส่งคำขอยืม"}
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-neutral-400">คำขอจะยังไม่ล็อกช่วงเวลาจนกว่าเจ้าของกด Accept; หากมีรายการอื่นถูก Accept ก่อน ระบบจะป้องกันการจองซ้อนอัตโนมัติ</p>
    </div>
  );
}
