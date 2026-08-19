"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentBrowserLocation, type GeolocationFailure } from "@/lib/browser-geolocation";
import { BoltIcon, ChevronRightIcon, MapPinIcon, SearchIcon, SlidersIcon } from "@/components/ui/icons";

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

function hasAdvancedFilters(initial: MarketplaceFilterValues) {
  return Boolean(
    initial.district ||
    initial.subdistrict ||
    initial.condition ||
    initial.pricingMode ||
    initial.urgent ||
    initial.minPrice !== null ||
    initial.maxPrice !== null ||
    initial.latitude !== null ||
    initial.longitude !== null ||
    (initial.sort && initial.sort !== "newest"),
  );
}

function appliedAdvancedCount(initial: MarketplaceFilterValues) {
  return [
    initial.district || initial.subdistrict,
    initial.condition,
    initial.pricingMode,
    initial.urgent,
    initial.minPrice !== null || initial.maxPrice !== null,
    initial.latitude !== null && initial.longitude !== null,
    initial.sort && initial.sort !== "newest",
  ].filter(Boolean).length;
}

function geoErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as GeolocationFailure).message);
  }
  return "อ่านตำแหน่งไม่สำเร็จ กรุณาลองใหม่หรือค้นหาด้วยจังหวัด";
}

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
  const formRef = useRef<HTMLFormElement>(null);
  const [showAdvanced, setShowAdvanced] = useState(() => hasAdvancedFilters(initial));
  const [locatingRadius, setLocatingRadius] = useState<number | null>(null);
  const [locationError, setLocationError] = useState("");
  const advancedCount = appliedAdvancedCount(initial);

  const paramsFromCurrentForm = () => {
    const params = new URLSearchParams();
    if (!formRef.current) return new URLSearchParams(window.location.search);
    const formData = new FormData(formRef.current);
    for (const [key, value] of formData.entries()) {
      if (typeof value !== "string") continue;
      const normalized = value.trim();
      if (normalized) params.set(key, normalized);
    }
    return params;
  };

  const requestCurrentLocation = async (radiusKm: number) => {
    setLocatingRadius(radiusKm);
    setLocationError("");
    try {
      const position = await getCurrentBrowserLocation();
      const params = paramsFromCurrentForm();
      params.set("lat", position.latitude.toFixed(6));
      params.set("lng", position.longitude.toFixed(6));
      params.set("radiusKm", String(radiusKm));
      params.set("sort", "distance");
      params.delete("page");
      router.push(`/rent?${params.toString()}`);
    } catch (error) {
      setLocationError(geoErrorMessage(error));
    } finally {
      setLocatingRadius(null);
    }
  };

  const clearCurrentLocation = () => {
    const params = paramsFromCurrentForm();
    params.delete("lat");
    params.delete("lng");
    params.delete("radiusKm");
    if (["distance", "nearest"].includes(params.get("sort") ?? "")) params.set("sort", "newest");
    params.delete("page");
    const query = params.toString();
    router.push(query ? `/rent?${query}` : "/rent");
  };

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5 md:p-6">
      <form ref={formRef} action="/rent" method="get" className="space-y-4">
        {initial.latitude !== null && initial.longitude !== null && (
          <>
            <input type="hidden" name="lat" value={initial.latitude} />
            <input type="hidden" name="lng" value={initial.longitude} />
            <input type="hidden" name="radiusKm" value={initial.radiusKm ?? 10} />
          </>
        )}

        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(160px,1fr)_minmax(160px,1fr)_auto] md:items-end">
          <label className="text-sm font-bold">
            ค้นหา
            <div className="relative mt-2">
              <SearchIcon size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                name="q"
                defaultValue={initial.q}
                maxLength={100}
                placeholder="ค้นหา เช่น เต็นท์ กล้อง สว่าน..."
                className="min-h-12 w-full rounded-xl border border-neutral-300 py-3 pl-11 pr-4 font-normal outline-none transition focus:border-[#c9a227]"
              />
            </div>
          </label>
          <label className="text-sm font-bold">
            หมวดหมู่
            <select name="category" defaultValue={initial.category} className="mt-2 min-h-12 w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 font-normal">
              <option value="">ทุกหมวดหมู่</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold">
            จังหวัด
            <select name="province" defaultValue={initial.province} className="mt-2 min-h-12 w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 font-normal">
              <option value="">ทุกจังหวัด</option>
              {provinces.map((province) => <option key={province} value={province}>{province}</option>)}
            </select>
          </label>
          <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-6 text-sm font-black text-white transition hover:bg-neutral-800">
            <SearchIcon size={17} />ค้นหา
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
          <button
            type="button"
            onClick={() => setShowAdvanced((current) => !current)}
            aria-expanded={showAdvanced}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-black text-neutral-700 transition hover:bg-neutral-50"
          >
            <SlidersIcon size={17} />
            ตัวกรองเพิ่มเติม
            {advancedCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#f3e7ae] px-1.5 text-[10px] text-[#725b13]">{advancedCount}</span>}
            <ChevronRightIcon size={16} className={`transition-transform ${showAdvanced ? "rotate-90" : ""}`} />
          </button>
          <Link href="/rent" className="text-xs font-bold text-neutral-500 underline-offset-4 hover:underline">ล้างตัวกรองทั้งหมด</Link>
        </div>

        {showAdvanced && (
          <div className="space-y-5 rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4 sm:p-5">
            <div>
              <div className="flex items-center gap-2">
                <MapPinIcon size={17} className="text-[#9d7d13]" />
                <p className="text-sm font-black">ค้นหาของใกล้ฉัน</p>
              </div>
              <p className="mt-1 text-xs leading-5 text-neutral-500">กดระยะที่ต้องการ แล้วอนุญาต Location เมื่อเบราว์เซอร์ถาม ระบบจะเรียงของที่ใกล้ที่สุดให้ทันที</p>
              <div className="hide-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
                {[5, 10, 20, 50].map((radius) => (
                  <button
                    key={radius}
                    type="button"
                    disabled={locatingRadius !== null}
                    onClick={() => void requestCurrentLocation(radius)}
                    className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-xs font-bold transition hover:border-[#c9a227] disabled:opacity-50 ${initial.radiusKm === radius ? "border-neutral-950 bg-neutral-950 text-white" : "bg-white"}`}
                  >
                    {locatingRadius === radius ? "กำลังหาตำแหน่ง..." : `ภายใน ${radius} กม.`}
                  </button>
                ))}
                {initial.latitude !== null && (
                  <button type="button" onClick={clearCurrentLocation} className="shrink-0 whitespace-nowrap rounded-full border bg-white px-4 py-2 text-xs font-bold text-neutral-500">
                    ยกเลิกตำแหน่ง
                  </button>
                )}
              </div>
              {initial.latitude !== null && initial.longitude !== null && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs font-semibold leading-5 text-emerald-800">
                  <MapPinIcon size={15} className="mt-0.5 shrink-0" />
                  <span>อ่านตำแหน่งสำเร็จแล้ว · กำลังค้นหาภายใน {initial.radiusKm ?? 10} กม. และคำนวณระยะทางฝั่ง server</span>
                </div>
              )}
              {locationError && <p role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs font-semibold leading-5 text-amber-800">{locationError}</p>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm font-bold">อำเภอ / เขต
                <input name="district" defaultValue={initial.district} maxLength={100} placeholder="เช่น เมืองชลบุรี" className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3 py-2.5 font-normal" />
              </label>
              <label className="text-sm font-bold">ตำบล / แขวง
                <input name="subdistrict" defaultValue={initial.subdistrict} maxLength={100} placeholder="เช่น แสนสุข" className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3 py-2.5 font-normal" />
              </label>
              <label className="text-sm font-bold">สภาพ
                <select name="condition" defaultValue={initial.condition} className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3 py-2.5 font-normal">
                  <option value="">ทั้งหมด</option>
                  <option value="NEW">ใหม่</option>
                  <option value="LIKE_NEW">เหมือนใหม่</option>
                  <option value="GOOD">ดี</option>
                  <option value="FAIR">พอใช้</option>
                  <option value="USED">มีร่องรอยใช้งาน</option>
                </select>
              </label>
              <label className="text-sm font-bold">รูปแบบราคา
                <select name="pricingMode" defaultValue={initial.pricingMode} className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3 py-2.5 font-normal">
                  <option value="">ทั้งหมด</option>
                  <option value="HOUR">รายชั่วโมง</option>
                  <option value="DAY">รายวัน</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm font-bold">ราคาต่ำสุด
                <input name="minPrice" type="number" min="0" step="1" defaultValue={initial.minPrice ?? ""} placeholder="0" className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3 py-2.5 font-normal" />
              </label>
              <label className="text-sm font-bold">ราคาสูงสุด
                <input name="maxPrice" type="number" min="0" step="1" defaultValue={initial.maxPrice ?? ""} placeholder="ไม่จำกัด" className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3 py-2.5 font-normal" />
              </label>
              <label className="text-sm font-bold">เรียงตาม
                <select name="sort" defaultValue={initial.sort} className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3 py-2.5 font-normal">
                  <option value="newest">ใหม่ล่าสุด</option>
                  <option value="price_asc">ราคาต่ำ → สูง</option>
                  <option value="price_desc">ราคาสูง → ต่ำ</option>
                  {initial.latitude !== null && <option value="distance">ใกล้ที่สุด</option>}
                </select>
              </label>
              <label className="mt-6 flex min-h-11 items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-bold">
                <input name="urgent" type="checkbox" value="1" defaultChecked={initial.urgent} className="h-4 w-4 shrink-0 accent-[#c9a227]" />
                <BoltIcon size={16} className="shrink-0 text-[var(--gold-strong)]" />
                <span>เฉพาะยืมด่วน</span>
              </label>
            </div>

            <div className="flex flex-col gap-2 border-t border-neutral-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <Link href="/location" className="inline-flex items-center gap-2 text-xs font-black text-[#806515] hover:underline">
                <MapPinIcon size={14} />เปิดหน้า Nearby แบบละเอียด
              </Link>
              <button type="submit" className="min-h-11 rounded-xl bg-neutral-950 px-6 text-sm font-black text-white">ใช้ตัวกรองเพิ่มเติม</button>
            </div>
          </div>
        )}
      </form>
    </section>
  );
}
