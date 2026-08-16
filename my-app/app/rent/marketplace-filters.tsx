"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type MarketplaceFilterValues = {
  q: string;
  category: string;
  province: string;
  district: string;
  subdistrict: string;
  condition: string;
  pricingMode: string;
  urgent: boolean;
  minPrice: number | null;
  maxPrice: number | null;
  latitude: number | null;
  longitude: number | null;
  radiusKm: number | null;
  sort: string;
};

export function MarketplaceFilters({
  initial,
  categories,
  provinces,
}: {
  initial: MarketplaceFilterValues;
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
        router.push(`/rent?${params.toString()}`);
        setLocating(false);
      },
      () => {
        setLocationError("อ่านตำแหน่งไม่ได้ — สามารถค้นหาด้วยจังหวัด/อำเภอ/ตำบลได้โดยไม่ต้องอนุญาต Location");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const clearCurrentLocation = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete("lat");
    params.delete("lng");
    params.delete("radiusKm");
    if (["distance", "nearest"].includes(params.get("sort") ?? "")) params.delete("sort");
    params.delete("page");
    const query = params.toString();
    router.push(query ? `/rent?${query}` : "/rent");
  };

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
      <form action="/rent" method="get" className="space-y-5">
        {initial.latitude !== null && initial.longitude !== null && (
          <>
            <input type="hidden" name="lat" value={initial.latitude} />
            <input type="hidden" name="lng" value={initial.longitude} />
            <input type="hidden" name="radiusKm" value={initial.radiusKm ?? 10} />
          </>
        )}

        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_1fr_1fr]">
          <label className="text-sm font-bold">
            ค้นหา
            <input
              name="q"
              defaultValue={initial.q}
              maxLength={100}
              placeholder="เต็นท์ กล้อง เครื่องมือ เกม..."
              className="mt-2 w-full rounded-xl border border-neutral-300 px-4 py-3 font-normal outline-none focus:border-[#c9a227]"
            />
          </label>
          <label className="text-sm font-bold">
            หมวดหมู่
            <select
              name="category"
              defaultValue={initial.category}
              className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 font-normal"
            >
              <option value="">ทั้งหมด</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold">
            จังหวัด
            <select
              name="province"
              defaultValue={initial.province}
              className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 font-normal"
            >
              <option value="">ทุกจังหวัด</option>
              {provinces.map((province) => <option key={province} value={province}>{province}</option>)}
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm font-bold">
            อำเภอ
            <input name="district" defaultValue={initial.district} maxLength={100} className="mt-2 w-full rounded-xl border px-3 py-2.5 font-normal" />
          </label>
          <label className="text-sm font-bold">
            ตำบล
            <input name="subdistrict" defaultValue={initial.subdistrict} maxLength={100} className="mt-2 w-full rounded-xl border px-3 py-2.5 font-normal" />
          </label>
          <label className="text-sm font-bold">
            สภาพ
            <select name="condition" defaultValue={initial.condition} className="mt-2 w-full rounded-xl border bg-white px-3 py-2.5 font-normal">
              <option value="">ทั้งหมด</option>
              <option value="NEW">ใหม่</option>
              <option value="LIKE_NEW">เหมือนใหม่</option>
              <option value="GOOD">ดี</option>
              <option value="FAIR">พอใช้</option>
              <option value="USED">มีร่องรอยใช้งาน</option>
            </select>
          </label>
          <label className="text-sm font-bold">
            รูปแบบราคา
            <select name="pricingMode" defaultValue={initial.pricingMode} className="mt-2 w-full rounded-xl border bg-white px-3 py-2.5 font-normal">
              <option value="">ทั้งหมด</option>
              <option value="HOUR">รายชั่วโมง</option>
              <option value="DAY">รายวัน</option>
            </select>
          </label>
          <label className="text-sm font-bold">
            เรียงตาม
            <select name="sort" defaultValue={initial.sort} className="mt-2 w-full rounded-xl border bg-white px-3 py-2.5 font-normal">
              <option value="newest">ใหม่ล่าสุด</option>
              <option value="price_asc">ราคาต่ำ → สูง</option>
              <option value="price_desc">ราคาสูง → ต่ำ</option>
              {initial.latitude !== null && <option value="distance">ใกล้ที่สุด</option>}
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
          <label className="text-sm font-bold">
            ราคาต่ำสุด
            <input name="minPrice" type="number" min="0" step="1" defaultValue={initial.minPrice ?? ""} className="mt-2 w-full rounded-xl border px-3 py-2.5 font-normal" />
          </label>
          <label className="text-sm font-bold">
            ราคาสูงสุด
            <input name="maxPrice" type="number" min="0" step="1" defaultValue={initial.maxPrice ?? ""} className="mt-2 w-full rounded-xl border px-3 py-2.5 font-normal" />
          </label>
          <label className="flex items-end gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold">
            <input name="urgent" type="checkbox" value="1" defaultChecked={initial.urgent} className="h-4 w-4 accent-[#c9a227]" />
            ⚡ เฉพาะยืมด่วนที่ว่างตอนนี้
          </label>
        </div>

        <div className="flex flex-col gap-3 border-t pt-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-black">ค้นหาของใกล้คุณ</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[5, 10, 20, 50].map((radius) => (
                <button
                  key={radius}
                  type="button"
                  disabled={locating}
                  onClick={() => requestCurrentLocation(radius)}
                  className={`rounded-full border px-4 py-2 text-xs font-bold transition hover:border-[#c9a227] disabled:opacity-50 ${initial.radiusKm === radius ? "border-neutral-900 bg-neutral-900 text-white" : "bg-white"}`}
                >
                  {locating ? "กำลังหาตำแหน่ง..." : `ภายใน ${radius} กม.`}
                </button>
              ))}
              {initial.latitude !== null && (
                <button type="button" onClick={clearCurrentLocation} className="rounded-full border px-4 py-2 text-xs font-bold text-neutral-500">
                  ยกเลิกตำแหน่ง
                </button>
              )}
              <Link href="/location" className="rounded-full border border-[#c9a227] px-4 py-2 text-xs font-bold text-[#806515]">หน้า Nearby เต็ม</Link>
            </div>
            {locationError && <p className="mt-2 text-xs font-semibold text-red-600">{locationError}</p>}
            {initial.latitude !== null && (
              <p className="mt-2 text-xs text-neutral-500">พิกัดผู้ค้นหาถูกใช้เพื่อคำนวณระยะทาง ส่วนพิกัดของเจ้าของรายการไม่ถูกส่งออกใน Public Marketplace API</p>
            )}
          </div>
          <div className="flex gap-2">
            <Link href="/rent" className="rounded-xl border px-5 py-3 text-sm font-bold">ล้างตัวกรอง</Link>
            <button type="submit" className="rounded-xl bg-neutral-900 px-6 py-3 text-sm font-black text-white hover:bg-neutral-800">ค้นหา</button>
          </div>
        </div>
      </form>
    </section>
  );
}
