"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const inputClass = "mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 font-normal outline-none focus:border-[#c9a227] focus:ring-2 focus:ring-[#c9a227]/15";

export default function CommunityRequestForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [coords, setCoords] = useState({ latitude: "", longitude: "" });

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessage("เบราว์เซอร์นี้ไม่รองรับ Location — กรอกพื้นที่ด้วยตนเองได้");
      return;
    }
    setLocating(true);
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        });
        setLocating(false);
      },
      () => {
        setMessage("อ่านตำแหน่งไม่ได้ คุณยังโพสต์ได้โดยใช้จังหวัด/อำเภอ/ตำบล");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMessage("");
    setErrors({});
    const form = new FormData(event.currentTarget);
    const starts = String(form.get("neededStartsAt") ?? "");
    const ends = String(form.get("neededEndsAt") ?? "");
    try {
      const response = await fetch("/api/community-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          description: form.get("description"),
          category: form.get("category"),
          province: form.get("province"),
          district: form.get("district"),
          subdistrict: form.get("subdistrict"),
          latitude: coords.latitude,
          longitude: coords.longitude,
          neededStartsAt: starts ? new Date(starts).toISOString() : "",
          neededEndsAt: ends ? new Date(ends).toISOString() : "",
          targetPrice: form.get("targetPrice"),
          isUrgent: form.get("isUrgent") === "1",
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        if (result.fieldErrors && typeof result.fieldErrors === "object") setErrors(result.fieldErrors);
        setMessage(result.message ?? "สร้างคำขอไม่สำเร็จ");
        return;
      }
      router.push(`/community/${result.request.id}`);
      router.refresh();
    } catch {
      setMessage("เชื่อมต่อระบบคอมมูหาของไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  };

  const FieldError = ({ name }: { name: string }) => errors[name] ? <p className="mt-1 text-xs font-semibold text-red-600">{errors[name]}</p> : null;

  return (
    <form onSubmit={submit} className="mt-8 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-8">
      <div className="grid gap-5">
        <label className="text-sm font-bold">ของที่กำลังหา
          <input name="title" maxLength={120} placeholder="เช่น โปรเจคเตอร์ Full HD สำหรับพรุ่งนี้" className={inputClass} />
          <FieldError name="title" />
        </label>
        <div className="grid gap-5 md:grid-cols-2">
          <label className="text-sm font-bold">หมวดหมู่
            <select name="category" defaultValue="" className={inputClass}>
              <option value="">เลือกหมวดหมู่</option>
              {["อิเล็กทรอนิกส์", "กล้องและอุปกรณ์ถ่ายภาพ", "เกม", "แคมป์ปิ้ง", "เครื่องมือ", "กีฬา", "ยานพาหนะและอุปกรณ์", "อื่น ๆ"].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <FieldError name="category" />
          </label>
          <label className="text-sm font-bold">งบเป้าหมาย (บาท / ไม่บังคับ)
            <input name="targetPrice" type="number" min="0" max="10000000" step="0.01" placeholder="500" className={inputClass} />
            <FieldError name="targetPrice" />
          </label>
        </div>
        <label className="text-sm font-bold">รายละเอียด
          <textarea name="description" rows={5} maxLength={3000} placeholder="บอกสเปก ของที่ต้องมี การใช้งาน หรือเงื่อนไขที่สำคัญ" className={inputClass} />
          <FieldError name="description" />
        </label>

        <section className="rounded-2xl bg-neutral-50 p-4 md:p-5">
          <h2 className="font-black">ช่วงเวลาที่ต้องการ</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-bold">เริ่มใช้<input name="neededStartsAt" type="datetime-local" className={inputClass} /><FieldError name="neededStartsAt" /></label>
            <label className="text-sm font-bold">คืน / สิ้นสุด<input name="neededEndsAt" type="datetime-local" className={inputClass} /><FieldError name="neededEndsAt" /></label>
          </div>
        </section>

        <section className="rounded-2xl bg-neutral-50 p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-black">พื้นที่ที่สะดวกรับของ</h2><p className="mt-1 text-xs text-neutral-500">พิกัดใช้ค้นหาระยะทางเท่านั้น และไม่เปิดต่อสาธารณะ</p></div>
            <button type="button" disabled={locating} onClick={useCurrentLocation} className="rounded-full border bg-white px-4 py-2 text-xs font-bold disabled:opacity-50">{locating ? "กำลังอ่านตำแหน่ง..." : "📍 ใช้ตำแหน่งปัจจุบัน"}</button>
          </div>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <label className="text-sm font-bold">จังหวัด<input name="province" placeholder="ชลบุรี" maxLength={100} className={inputClass} /><FieldError name="province" /></label>
            <label className="text-sm font-bold">อำเภอ / เขต<input name="district" placeholder="เมืองชลบุรี" maxLength={100} className={inputClass} /></label>
            <label className="text-sm font-bold">ตำบล / แขวง<input name="subdistrict" placeholder="แสนสุข" maxLength={100} className={inputClass} /></label>
          </div>
          {coords.latitude && <p className="mt-3 text-xs font-semibold text-green-700">✓ บันทึกจุดอ้างอิงสำหรับค้นหาระยะทางแล้ว</p>}
          <FieldError name="locationCoordinates" />
        </section>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#c9a227]/40 bg-[#fffaf0] p-4">
          <input name="isUrgent" type="checkbox" value="1" className="mt-1 h-5 w-5 accent-[#c9a227]" />
          <span><b>⚡ ต้องการด่วน</b><span className="mt-1 block text-xs text-neutral-600">ให้คำขอถูกดันขึ้นในตัวกรองด่วน แต่เมื่อจับคู่แล้วจะใช้ Checkout/Payment ปกติ ไม่สร้างค่าธรรมเนียมใหม่</span></span>
        </label>

        {message && <p className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{message}</p>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href="/community" className="rounded-xl border px-5 py-3 text-center text-sm font-bold">ยกเลิก</Link>
          <button type="submit" disabled={submitting} className="rounded-xl bg-neutral-950 px-6 py-3 text-sm font-black text-white disabled:opacity-50">{submitting ? "กำลังโพสต์..." : "โพสต์คำขอหาของ"}</button>
        </div>
      </div>
    </form>
  );
}
