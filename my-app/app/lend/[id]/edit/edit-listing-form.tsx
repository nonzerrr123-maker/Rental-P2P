"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BoltIcon, ImageIcon, MapPinIcon, SaveIcon } from "@/components/ui/icons";
import { StatusPill } from "@/components/ui/primitives";
import { URGENT_RESERVATION_FEE_PERCENT } from "@/lib/rental/fees";
import type { RentalListing } from "@/lib/rental/listings";
import ListingImageManager from "../../listing-image-manager";

const inputClass = "bb-input mt-2 min-h-12";
const categories = [
  "อิเล็กทรอนิกส์",
  "กล้องและอุปกรณ์ถ่ายภาพ",
  "เกม",
  "แคมป์ปิ้ง",
  "เครื่องมือ",
  "กีฬา",
  "ยานพาหนะและอุปกรณ์",
  "อื่น ๆ",
];

type ListingForm = {
  title: string;
  category: string;
  description: string;
  condition: RentalListing["condition"];
  hourlyRate: string;
  dailyRate: string;
  minimumHours: string;
  depositAmount: string;
  urgentEnabled: boolean;
  province: string;
  district: string;
  subdistrict: string;
  locationLabel: string;
  latitude: string;
  longitude: string;
};

function fromListing(item: RentalListing): ListingForm {
  return {
    title: item.title,
    category: item.category,
    description: item.description,
    condition: item.condition,
    hourlyRate: item.hourlyRate ?? "",
    dailyRate: item.dailyRate ?? "",
    minimumHours: String(item.minimumHours),
    depositAmount: item.depositAmount,
    urgentEnabled: item.urgentEnabled,
    province: item.province,
    district: item.district ?? "",
    subdistrict: item.subdistrict ?? "",
    locationLabel: item.locationLabel ?? "",
    latitude: item.latitude ?? "",
    longitude: item.longitude ?? "",
  };
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1.5 text-xs font-semibold text-red-600">{message}</p> : null;
}

export default function EditListingForm({ item }: { item: RentalListing }) {
  const router = useRouter();
  const initial = useMemo(() => fromListing(item), [item]);
  const [form, setForm] = useState<ListingForm>(initial);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [imageRefreshKey, setImageRefreshKey] = useState(0);
  const [newImages, setNewImages] = useState<File[]>([]);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || newImages.length > 0;
  const archived = item.status === "ARCHIVED";

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = <K extends keyof ListingForm>(key: K, value: ListingForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const uploadNewImages = async (): Promise<string[]> => {
    const failures: string[] = [];
    for (let index = 0; index < newImages.length; index += 1) {
      const file = newImages[index];
      const body = new FormData();
      body.set("file", file);
      body.set("altText", `${form.title} รูปเพิ่ม ${index + 1}`);
      try {
        const response = await fetch(`/api/rental-items/${item.id}/images`, { method: "POST", body });
        const payload = await response.json();
        if (!response.ok || !payload.ok) failures.push(`${file.name}: ${payload.message ?? "อัปโหลดไม่สำเร็จ"}`);
      } catch {
        failures.push(`${file.name}: เชื่อมต่อระบบรูปไม่สำเร็จ`);
      }
    }
    return failures;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || archived) return;
    setSaving(true);
    setFieldErrors({});
    setMessage("");
    try {
      const response = await fetch(`/api/rental-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        if (payload.fieldErrors && typeof payload.fieldErrors === "object") setFieldErrors(payload.fieldErrors);
        setMessage(payload.message ?? "บันทึกการแก้ไขไม่สำเร็จ");
        return;
      }

      const failures = newImages.length ? await uploadNewImages() : [];
      setNewImages([]);
      setImageRefreshKey((value) => value + 1);
      setForm(fromListing(payload.item as RentalListing));
      setMessage(failures.length ? `บันทึกข้อมูลแล้ว แต่บางรูปอัปโหลดไม่สำเร็จ: ${failures.join(" · ")}` : "บันทึกการแก้ไขแล้ว");
      router.refresh();
    } catch {
      setMessage("เชื่อมต่อระบบแก้ไขประกาศไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form onSubmit={submit} className="rounded-[28px] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-5">
          <div>
            <p className="bb-label">Edit listing</p>
            <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-3xl">แก้ไขประกาศ</h1>
          </div>
          <StatusPill>{item.status}</StatusPill>
        </div>

        {archived ? (
          <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">ประกาศที่เก็บถาวรเป็นแบบอ่านอย่างเดียว กรุณาเปิดประกาศกลับมาก่อนแก้ไข</p>
        ) : null}
        {message ? <p role="status" className="mt-5 rounded-2xl bg-[var(--surface-2)] p-4 text-sm font-semibold">{message}</p> : null}

        <div className="mt-6 grid gap-5">
          <label className="text-sm font-bold">ชื่อสิ่งของ
            <input value={form.title} onChange={(e) => update("title", e.target.value)} className={inputClass} maxLength={120}/>
            <FieldError message={fieldErrors.title}/>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold">หมวดหมู่
              <select value={form.category} onChange={(e) => update("category", e.target.value)} className={inputClass}>
                <option value="">เลือกหมวดหมู่</option>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              <FieldError message={fieldErrors.category}/>
            </label>
            <label className="text-sm font-bold">สภาพ
              <select value={form.condition} onChange={(e) => update("condition", e.target.value as ListingForm["condition"])} className={inputClass}>
                <option value="NEW">ใหม่</option><option value="LIKE_NEW">เหมือนใหม่</option><option value="GOOD">สภาพดี</option><option value="FAIR">พอใช้</option><option value="USED">มีร่องรอยการใช้งาน</option>
              </select>
            </label>
          </div>

          <label className="text-sm font-bold">รายละเอียด
            <textarea value={form.description} onChange={(e) => update("description", e.target.value)} className={`${inputClass} resize-y`} rows={5} maxLength={3000}/>
            <FieldError message={fieldErrors.description}/>
          </label>

          <section className="rounded-2xl bg-[var(--surface-2)] p-4 sm:p-5">
            <h2 className="font-black">ราคาและเงินประกัน</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold">ค่าเช่า / ชั่วโมง<input type="number" min="0" step="0.01" value={form.hourlyRate} onChange={(e) => update("hourlyRate", e.target.value)} className={inputClass}/><FieldError message={fieldErrors.hourlyRate}/></label>
              <label className="text-sm font-bold">ค่าเช่า / วัน<input type="number" min="0" step="0.01" value={form.dailyRate} onChange={(e) => update("dailyRate", e.target.value)} className={inputClass}/><FieldError message={fieldErrors.dailyRate}/></label>
            </div>
            <FieldError message={fieldErrors.pricing}/>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold">ชั่วโมงขั้นต่ำ<input type="number" min="1" max="168" value={form.minimumHours} onChange={(e) => update("minimumHours", e.target.value)} className={inputClass}/><FieldError message={fieldErrors.minimumHours}/></label>
              <label className="text-sm font-bold">เงินประกัน<input type="number" min="0" step="0.01" value={form.depositAmount} onChange={(e) => update("depositAmount", e.target.value)} className={inputClass}/><FieldError message={fieldErrors.depositAmount}/></label>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--gold-line)] bg-[var(--gold-soft)] p-4 sm:p-5">
            <label className="flex items-start justify-between gap-4">
              <span><span className="inline-flex items-center gap-2 font-black"><BoltIcon size={17}/>ยืมด่วน</span><span className="mt-1 block text-xs leading-5 text-[var(--muted-strong)]">ค่าจองผ่านแพลตฟอร์ม {URGENT_RESERVATION_FEE_PERCENT}% กำหนดโดยระบบ</span></span>
              <input type="checkbox" checked={form.urgentEnabled} onChange={(e) => update("urgentEnabled", e.target.checked)} className="mt-1 h-5 w-5 accent-black"/>
            </label>
          </section>

          <section className="rounded-2xl border border-[var(--line)] p-4 sm:p-5">
            <div className="flex items-center gap-2"><MapPinIcon size={17} className="text-[var(--gold-strong)]"/><h2 className="font-black">พื้นที่และ Nearby</h2></div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold">จังหวัด<input value={form.province} onChange={(e) => update("province", e.target.value)} className={inputClass}/><FieldError message={fieldErrors.province}/></label>
              <label className="text-sm font-bold">อำเภอ<input value={form.district} onChange={(e) => update("district", e.target.value)} className={inputClass}/></label>
              <label className="text-sm font-bold">ตำบล<input value={form.subdistrict} onChange={(e) => update("subdistrict", e.target.value)} className={inputClass}/></label>
              <label className="text-sm font-bold">จุดนัดหมายโดยย่อ<input value={form.locationLabel} onChange={(e) => update("locationLabel", e.target.value)} className={inputClass}/></label>
              <label className="text-sm font-bold">Latitude<input type="number" step="0.000001" value={form.latitude} onChange={(e) => update("latitude", e.target.value)} className={inputClass}/></label>
              <label className="text-sm font-bold">Longitude<input type="number" step="0.000001" value={form.longitude} onChange={(e) => update("longitude", e.target.value)} className={inputClass}/></label>
            </div>
            <FieldError message={fieldErrors.locationCoordinates}/>
          </section>

          <section className="rounded-2xl border border-[var(--line)] p-4 sm:p-5">
            <div className="flex items-center gap-2"><ImageIcon size={17} className="text-[var(--gold-strong)]"/><h2 className="font-black">เพิ่มรูป</h2></div>
            <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => setNewImages(Array.from(event.target.files ?? []).slice(0, 8))} className={`${inputClass} py-3`}/>
            {newImages.length ? <p className="mt-2 text-xs text-[var(--muted)]">เลือกใหม่ {newImages.length} รูป ระบบจะตรวจจำนวนรวมสูงสุด 8 รูปอีกครั้ง</p> : null}
          </section>
        </div>

        <div className="mt-7 flex flex-wrap gap-3 border-t border-[var(--line)] pt-5">
          <button type="submit" disabled={saving || archived || !dirty} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--ink)] px-5 text-sm font-black text-white disabled:opacity-40"><SaveIcon size={16}/>{saving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}</button>
          <Link href={`/rent/${item.id}`} className="inline-flex min-h-11 items-center rounded-xl border border-[var(--line)] px-5 text-sm font-black">ดูประกาศ</Link>
          <Link href="/lend" className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-[var(--muted-strong)]">กลับไปจัดการของ</Link>
        </div>
      </form>

      <aside>
        <div className="sticky top-24 rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-5">
          <p className="bb-label">Booking safety</p>
          <h2 className="mt-2 font-black">การแก้ไขมีผลกับการจองใหม่</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">ราคา เงินประกัน และช่วงเวลาของ Rental Request ที่สร้างไปแล้วถูก snapshot ไว้ ไม่ย้อนแก้ธุรกรรมเดิม</p>
          <p className="mt-4 text-xs font-semibold text-[var(--muted)]">แก้ไขล่าสุด {new Date(item.updatedAt).toLocaleString("th-TH")}</p>
        </div>
      </aside>

      <div className="lg:col-span-2"><ListingImageManager itemId={item.id} refreshKey={imageRefreshKey}/></div>
    </div>
  );
}
