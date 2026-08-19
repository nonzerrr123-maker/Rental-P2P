"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentBrowserLocation, type GeolocationFailure } from "@/lib/browser-geolocation";
import { MapPinIcon } from "@/components/ui/icons";

type Initial = {
  province: string;
  district: string;
  subdistrict: string;
  urgent: boolean;
  latitude: number | null;
  longitude: number | null;
  radiusKm: number | null;
};

function geoMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) return String((error as GeolocationFailure).message);
  return "อ่านตำแหน่งไม่สำเร็จ กรุณาลองใหม่หรือเลือกจังหวัดแทน";
}

export default function NearbyControls({ initial, provinces }: { initial: Initial; provinces: string[] }) {
  const router = useRouter();
  const [locatingRadius, setLocatingRadius] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const requestCurrentLocation = async (radiusKm: number) => {
    setLocatingRadius(radiusKm);
    setMessage("");
    try {
      const position = await getCurrentBrowserLocation();
      const params = new URLSearchParams();
      params.set("lat", position.latitude.toFixed(6));
      params.set("lng", position.longitude.toFixed(6));
      params.set("radiusKm", String(radiusKm));
      params.set("sort", "distance");
      if (initial.urgent) params.set("urgent", "1");
      router.push(`/location?${params.toString()}`);
    } catch (error) {
      setMessage(geoMessage(error));
    } finally {
      setLocatingRadius(null);
    }
  };

  return (
    <section className="rounded-3xl border bg-white p-5 shadow-sm md:p-6">
      <div>
        <div className="flex items-center gap-2"><MapPinIcon size={18} className="text-[#9d7d13]"/><p className="text-sm font-black">ค้นหาจากตำแหน่งปัจจุบัน</p></div>
        <p className="mt-1 text-xs leading-5 text-neutral-500">เลือกว่าต้องการค้นหาไกลแค่ไหน แล้วอนุญาต Location เมื่อเบราว์เซอร์ถาม ระบบจะคำนวณระยะทางจาก GPS จริงโดยไม่เปิดพิกัดเจ้าของต่อสาธารณะ</p>
        <div className="hide-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
          {[5, 10, 20, 50].map((radius) => (
            <button
              key={radius}
              type="button"
              disabled={locatingRadius !== null}
              onClick={() => void requestCurrentLocation(radius)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-50 ${initial.radiusKm === radius ? "border-neutral-950 bg-neutral-950 text-white" : "hover:border-[#c9a227]"}`}
            >
              {locatingRadius === radius ? "กำลังอ่านตำแหน่ง..." : `${radius} กม.`}
            </button>
          ))}
          {initial.latitude !== null && <Link href="/location" className="shrink-0 rounded-full border px-4 py-2 text-sm font-bold text-neutral-500">ล้างตำแหน่ง</Link>}
        </div>
        {initial.latitude !== null && initial.longitude !== null && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs font-semibold leading-5 text-emerald-800">
            <MapPinIcon size={15} className="mt-0.5 shrink-0" />
            <span>GPS ทำงานแล้ว · กำลังค้นหารายการภายใน {initial.radiusKm ?? 10} กม. เรียงจากใกล้ที่สุด</span>
          </div>
        )}
        {message && <p role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs font-semibold leading-5 text-amber-800">{message}</p>}
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
            เฉพาะยืมด่วนที่ว่างตอนนี้
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
