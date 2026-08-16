"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Initial = {
  province: string;
  district: string;
  subdistrict: string;
  urgent: boolean;
  latitude: number | null;
  longitude: number | null;
  radiusKm: number | null;
};

export default function NearbyControls({ initial, provinces }: { initial: Initial; provinces: string[] }) {
  const router = useRouter();
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");

  const requestCurrentLocation = (radiusKm: number) => {
    if (!navigator.geolocation) {
      setMessage("เบราว์เซอร์นี้ไม่รองรับ Location — ใช้จังหวัด/อำเภอ/ตำบลด้านล่างแทนได้");
      return;
    }
    setLocating(true);
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const params = new URLSearchParams();
        params.set("lat", position.coords.latitude.toFixed(4));
        params.set("lng", position.coords.longitude.toFixed(4));
        params.set("radiusKm", String(radiusKm));
        params.set("sort", "nearest");
        if (initial.urgent) params.set("urgent", "1");
        router.push(`/location?${params.toString()}`);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setMessage("ไม่สามารถอ่านตำแหน่งได้ — ค้นหาด้วยจังหวัด/อำเภอ/ตำบลได้โดยไม่ต้องเปิด Location");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  return (
    <section className="rounded-3xl border bg-white p-5 shadow-sm md:p-6">
      <div>
        <p className="text-sm font-black">ค้นหาจากตำแหน่งปัจจุบัน</p>
        <p className="mt-1 text-xs text-neutral-500">พิกัดนี้ใช้เป็นจุดอ้างอิงการค้นหาเท่านั้น รายการสาธารณะไม่เปิดพิกัดจริงของเจ้าของของ</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[5, 10, 20, 50].map((radius) => (
            <button
              key={radius}
              type="button"
              disabled={locating}
              onClick={() => requestCurrentLocation(radius)}
              className={`rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-50 ${initial.radiusKm === radius ? "border-neutral-950 bg-neutral-950 text-white" : "hover:border-[#c9a227]"}`}
            >
              {locating ? "กำลังอ่านตำแหน่ง..." : `${radius} กม.`}
            </button>
          ))}
          {initial.latitude !== null && <Link href="/location" className="rounded-full border px-4 py-2 text-sm font-bold text-neutral-500">ล้างตำแหน่ง</Link>}
        </div>
        {message && <p className="mt-2 text-xs font-semibold text-amber-700">{message}</p>}
      </div>

      <form action="/location" method="get" className="mt-6 border-t pt-5">
        <p className="text-sm font-black">หรือเลือกพื้นที่ด้วยตนเอง</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="text-sm font-bold">จังหวัด
            <select name="province" defaultValue={initial.province} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal">
              <option value="">ทุกจังหวัด</option>
              {provinces.map((province) => <option key={province} value={province}>{province}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold">อำเภอ / เขต
            <input name="district" defaultValue={initial.district} maxLength={100} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" />
          </label>
          <label className="text-sm font-bold">ตำบล / แขวง
            <input name="subdistrict" defaultValue={initial.subdistrict} maxLength={100} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold">
            <input name="urgent" type="checkbox" value="1" defaultChecked={initial.urgent} className="h-4 w-4 accent-[#c9a227]" />
            ⚡ เฉพาะยืมด่วนที่ว่างตอนนี้
          </label>
          <div className="flex gap-2">
            <Link href="/location" className="rounded-xl border px-5 py-3 text-sm font-bold">ล้าง</Link>
            <button type="submit" className="rounded-xl bg-neutral-950 px-5 py-3 text-sm font-black text-white">ค้นหาพื้นที่</button>
          </div>
        </div>
      </form>
    </section>
  );
}
