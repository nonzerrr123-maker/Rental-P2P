"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type CommunityFilterValues = {
  q: string;
  category: string;
  province: string;
  district: string;
  subdistrict: string;
  urgent: boolean;
  sort: string;
  status: string;
  mine: boolean;
  latitude: number | null;
  longitude: number | null;
  radiusKm: number | null;
};

export default function CommunityFilters({
  initial,
  categories,
  provinces,
}: {
  initial: CommunityFilterValues;
  categories: string[];
  provinces: string[];
}) {
  const router = useRouter();
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  const requestCurrentLocation = (radiusKm: number) => {
    if (!navigator.geolocation) {
      setLocationError("เบราว์เซอร์นี้ไม่รองรับ Location — ใช้จังหวัด/อำเภอ/ตำบลแทนได้");
      return;
    }
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const params = new URLSearchParams(window.location.search);
        params.set("lat", position.coords.latitude.toFixed(4));
        params.set("lng", position.coords.longitude.toFixed(4));
        params.set("radiusKm", String(radiusKm));
        params.set("sort", "nearest");
        params.delete("page");
        router.push(`/community?${params.toString()}`);
        setLocating(false);
      },
      () => {
        setLocationError("อ่านตำแหน่งไม่ได้ กรุณาอนุญาต Location หรือค้นหาด้วยพื้นที่แทน");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const clearLocation = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete("lat");
    params.delete("lng");
    params.delete("radiusKm");
    if (params.get("sort") === "nearest") params.set("sort", "newest");
    params.delete("page");
    router.push(`/community?${params.toString()}`);
  };

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
      <form action="/community" method="get" className="space-y-5">
        {initial.latitude !== null && initial.longitude !== null && (
          <>
            <input type="hidden" name="lat" value={initial.latitude} />
            <input type="hidden" name="lng" value={initial.longitude} />
            <input type="hidden" name="radiusKm" value={initial.radiusKm ?? 10} />
          </>
        )}
        {initial.mine && <input type="hidden" name="mine" value="1" />}

        <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
          <label className="text-sm font-bold">ค้นหาของที่คนกำลังต้องการ
            <input name="q" defaultValue={initial.q} maxLength={100} placeholder="เช่น โปรเจคเตอร์ กล้อง เต็นท์..." className="mt-2 w-full rounded-xl border px-4 py-3 font-normal outline-none focus:border-[#c9a227]" />
          </label>
          <label className="text-sm font-bold">หมวดหมู่
            <select name="category" defaultValue={initial.category} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal">
              <option value="">ทั้งหมด</option>
              {categories.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold">จังหวัด
            <select name="province" defaultValue={initial.province} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal">
              <option value="">ทุกจังหวัด</option>
              {provinces.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm font-bold">อำเภอ / เขต<input name="district" defaultValue={initial.district} maxLength={100} className="mt-2 w-full rounded-xl border px-3 py-2.5 font-normal" /></label>
          <label className="text-sm font-bold">ตำบล / แขวง<input name="subdistrict" defaultValue={initial.subdistrict} maxLength={100} className="mt-2 w-full rounded-xl border px-3 py-2.5 font-normal" /></label>
          <label className="text-sm font-bold">เรียงตาม
            <select name="sort" defaultValue={initial.sort} className="mt-2 w-full rounded-xl border bg-white px-3 py-2.5 font-normal">
              <option value="newest">ใหม่ล่าสุด</option>
              <option value="urgent">ด่วนก่อน</option>
              {initial.latitude !== null && <option value="nearest">ใกล้ที่สุด</option>}
            </select>
          </label>
          {initial.mine ? (
            <label className="text-sm font-bold">สถานะ
              <select name="status" defaultValue={initial.status} className="mt-2 w-full rounded-xl border bg-white px-3 py-2.5 font-normal">
                <option value="ALL">ทั้งหมด</option>
                <option value="OPEN">เปิดรับข้อเสนอ</option>
                <option value="MATCHED">จับคู่แล้ว</option>
                <option value="CLOSED">ปิดแล้ว</option>
                <option value="CANCELLED">ยกเลิก</option>
                <option value="EXPIRED">หมดอายุ</option>
              </select>
            </label>
          ) : <div />}
          <label className="flex items-end gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold">
            <input name="urgent" type="checkbox" value="1" defaultChecked={initial.urgent} className="h-4 w-4 accent-[#c9a227]" />
            ⚡ ต้องการด่วน
          </label>
        </div>

        <div className="flex flex-col gap-4 border-t pt-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black">คำขอใกล้ฉัน</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[5, 10, 20, 50].map((radius) => (
                <button key={radius} type="button" disabled={locating} onClick={() => requestCurrentLocation(radius)} className={`rounded-full border px-4 py-2 text-xs font-bold disabled:opacity-50 ${initial.radiusKm === radius ? "border-neutral-950 bg-neutral-950 text-white" : "hover:border-[#c9a227]"}`}>
                  {locating ? "กำลังหา..." : `${radius} กม.`}
                </button>
              ))}
              {initial.latitude !== null && <button type="button" onClick={clearLocation} className="rounded-full border px-4 py-2 text-xs font-bold text-neutral-500">ล้างตำแหน่ง</button>}
            </div>
            {locationError && <p className="mt-2 text-xs font-semibold text-red-600">{locationError}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={initial.mine ? "/community?mine=1" : "/community"} className="rounded-xl border px-5 py-3 text-sm font-bold">ล้างตัวกรอง</Link>
            <button type="submit" className="rounded-xl bg-neutral-950 px-6 py-3 text-sm font-black text-white">ค้นหา</button>
          </div>
        </div>
      </form>
    </section>
  );
}
