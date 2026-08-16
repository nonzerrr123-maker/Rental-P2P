"use client";

import { useMemo, useState } from "react";

type Item = {
  id: string;
  title: string;
  province: string;
  district: string | null;
  subdistrict: string | null;
  locationLabel: string | null;
  latitude: string | null;
  longitude: string | null;
};

type FormState = {
  province: string;
  district: string;
  subdistrict: string;
  locationLabel: string;
  latitude: string;
  longitude: string;
};

function formFromItem(item: Item): FormState {
  return {
    province: item.province,
    district: item.district ?? "",
    subdistrict: item.subdistrict ?? "",
    locationLabel: item.locationLabel ?? "",
    latitude: item.latitude ?? "",
    longitude: item.longitude ?? "",
  };
}

const inputClass = "mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 font-normal outline-none focus:border-[#c9a227]";

export default function LocationEditor({ items }: { items: Item[] }) {
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);
  const [formById, setFormById] = useState<Record<string, FormState>>(
    Object.fromEntries(items.map((item) => [item.id, formFromItem(item)])),
  );
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const form = selectedId ? formById[selectedId] : undefined;

  const update = (key: keyof FormState, value: string) => {
    if (!selectedId || !form) return;
    setFormById((current) => ({ ...current, [selectedId]: { ...current[selectedId], [key]: value } }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessage("เบราว์เซอร์นี้ไม่รองรับ Location กรุณากรอกพื้นที่ด้วยตนเอง");
      return;
    }
    setLocating(true);
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        update("latitude", position.coords.latitude.toFixed(6));
        update("longitude", position.coords.longitude.toFixed(6));
        setLocating(false);
        setMessage("อ่านตำแหน่งปัจจุบันแล้ว ตรวจสอบจังหวัด/อำเภอ/ตำบลก่อนบันทึก");
      },
      () => {
        setLocating(false);
        setMessage("อ่านตำแหน่งไม่ได้ สามารถกรอกจังหวัด/อำเภอ/ตำบลแทนได้โดยไม่ต้องอนุญาต Location");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const save = async () => {
    if (!selectedId || !form) return;
    setBusy(true);
    setMessage("");
    setFieldErrors({});
    try {
      const response = await fetch(`/api/rental-items/${selectedId}/location`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json() as { ok?: boolean; message?: string; fieldErrors?: Record<string, string> };
      if (!response.ok || !payload.ok) {
        setFieldErrors(payload.fieldErrors ?? {});
        setMessage(payload.message ?? "บันทึกพื้นที่ไม่สำเร็จ");
        return;
      }
      setMessage("บันทึกพื้นที่แล้ว ✓ Nearby Marketplace จะใช้ข้อมูลล่าสุดทันที");
    } catch {
      setMessage("เชื่อมต่อระบบบันทึกพื้นที่ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  if (!items.length) {
    return <div className="rounded-3xl border bg-white p-10 text-center"><p className="font-black">ยังไม่มีประกาศ</p><p className="mt-2 text-sm text-neutral-500">สร้างประกาศก่อน แล้วค่อยกลับมากำหนดพิกัด Nearby</p></div>;
  }

  return (
    <section className="rounded-3xl border bg-white p-5 shadow-sm md:p-7">
      <label className="text-sm font-black">เลือกประกาศ
        <select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setMessage(""); setFieldErrors({}); }} className={inputClass}>
          {items.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </label>

      {selected && form && (
        <div className="mt-6 grid gap-5">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-bold">จังหวัด
              <input value={form.province} onChange={(event) => update("province", event.target.value)} className={inputClass} maxLength={100} />
              {fieldErrors.province && <p className="mt-1 text-xs font-semibold text-red-600">{fieldErrors.province}</p>}
            </label>
            <label className="text-sm font-bold">อำเภอ / เขต
              <input value={form.district} onChange={(event) => update("district", event.target.value)} className={inputClass} maxLength={100} />
            </label>
            <label className="text-sm font-bold">ตำบล / แขวง
              <input value={form.subdistrict} onChange={(event) => update("subdistrict", event.target.value)} className={inputClass} maxLength={100} />
            </label>
          </div>

          <label className="text-sm font-bold">จุดนัดหมายโดยประมาณ
            <input value={form.locationLabel} onChange={(event) => update("locationLabel", event.target.value)} placeholder="เช่น ใกล้ห้าง / สถานี / มหาวิทยาลัย" className={inputClass} maxLength={160} />
          </label>

          <div className="rounded-2xl bg-neutral-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="font-black">พิกัดสำหรับคำนวณระยะทาง</p><p className="mt-1 text-xs text-neutral-500">ใช้เพื่อคำนวณ distance ฝั่ง server เท่านั้น Public Marketplace ไม่คืนพิกัดนี้</p></div>
              <button type="button" disabled={locating} onClick={useCurrentLocation} className="rounded-xl border border-[#c9a227] bg-white px-4 py-2.5 text-sm font-black text-[#806515] disabled:opacity-50">{locating ? "กำลังอ่านตำแหน่ง..." : "📍 ใช้ตำแหน่งปัจจุบัน"}</button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold">Latitude
                <input type="number" min="-90" max="90" step="0.000001" value={form.latitude} onChange={(event) => update("latitude", event.target.value)} className={inputClass} />
                {fieldErrors.latitude && <p className="mt-1 text-xs font-semibold text-red-600">{fieldErrors.latitude}</p>}
              </label>
              <label className="text-sm font-bold">Longitude
                <input type="number" min="-180" max="180" step="0.000001" value={form.longitude} onChange={(event) => update("longitude", event.target.value)} className={inputClass} />
                {fieldErrors.longitude && <p className="mt-1 text-xs font-semibold text-red-600">{fieldErrors.longitude}</p>}
              </label>
            </div>
            {fieldErrors.locationCoordinates && <p className="mt-2 text-xs font-semibold text-red-600">{fieldErrors.locationCoordinates}</p>}
          </div>

          {message && <p className={`rounded-xl p-3 text-sm font-semibold ${message.includes("✓") ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-800"}`}>{message}</p>}
          <button type="button" disabled={busy} onClick={() => void save()} className="rounded-xl bg-neutral-950 px-5 py-3.5 font-black text-white disabled:opacity-50">{busy ? "กำลังบันทึก..." : "บันทึกพื้นที่ประกาศ"}</button>
        </div>
      )}
    </section>
  );
}
