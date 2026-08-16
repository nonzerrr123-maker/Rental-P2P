"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import ListingImageManager from "./listing-image-manager";

type RentalListing = {
  id: string;
  title: string;
  category: string;
  status: "ACTIVE" | "PAUSED" | "UNAVAILABLE" | "ARCHIVED";
  hourlyRate: string | null;
  dailyRate: string | null;
  minimumHours: number;
  depositAmount: string;
  urgentEnabled: boolean;
  urgentReservationFeeRate: string;
  province: string;
  district: string | null;
  subdistrict: string | null;
  createdAt: string;
};

type ListingForm = {
  title: string;
  category: string;
  description: string;
  condition: "NEW" | "LIKE_NEW" | "GOOD" | "FAIR" | "USED";
  hourlyRate: string;
  dailyRate: string;
  minimumHours: string;
  depositAmount: string;
  urgentEnabled: boolean;
  urgentFeePercent: string;
  province: string;
  district: string;
  subdistrict: string;
  locationLabel: string;
  latitude: string;
  longitude: string;
};

type SelectedImage = { id: string; file: File; previewUrl: string };

const initialForm: ListingForm = {
  title: "",
  category: "",
  description: "",
  condition: "GOOD",
  hourlyRate: "",
  dailyRate: "",
  minimumHours: "1",
  depositAmount: "0",
  urgentEnabled: false,
  urgentFeePercent: "5",
  province: "",
  district: "",
  subdistrict: "",
  locationLabel: "",
  latitude: "",
  longitude: "",
};

const inputClass = "mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 font-normal outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20";
const MAX_IMAGES = 8;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const CLIENT_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1.5 text-xs font-medium text-red-600">{message}</p> : null;
}

function priceText(item: RentalListing): string {
  const parts: string[] = [];
  if (item.hourlyRate) parts.push(`${Number(item.hourlyRate).toLocaleString("th-TH")} ฿/ชม.`);
  if (item.dailyRate) parts.push(`${Number(item.dailyRate).toLocaleString("th-TH")} ฿/วัน`);
  return parts.join(" · ");
}

async function fetchMine(): Promise<RentalListing[]> {
  const response = await fetch("/api/rental-items/mine", { cache: "no-store" });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.message ?? "โหลดรายการของฉันไม่สำเร็จ");
  return result.items;
}

async function uploadImages(itemId: string, title: string, images: SelectedImage[]): Promise<string[]> {
  const failures: string[] = [];
  for (let index = 0; index < images.length; index += 1) {
    const formData = new FormData();
    formData.set("file", images[index].file);
    formData.set("altText", `${title} รูปที่ ${index + 1}`);
    try {
      const response = await fetch(`/api/rental-items/${itemId}/images`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok || !result.ok) failures.push(`${images[index].file.name}: ${result.message ?? "อัปโหลดไม่สำเร็จ"}`);
    } catch {
      failures.push(`${images[index].file.name}: เชื่อมต่อ object storage ไม่สำเร็จ`);
    }
  }
  return failures;
}

export default function LendForm() {
  const [form, setForm] = useState<ListingForm>(initialForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [imageMessage, setImageMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingMine, setLoadingMine] = useState(true);
  const [items, setItems] = useState<RentalListing[]>([]);
  const [created, setCreated] = useState<RentalListing | null>(null);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [imageRefreshKey, setImageRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    void fetchMine()
      .then((nextItems) => active && setItems(nextItems))
      .catch((error: unknown) => active && setMessage(error instanceof Error ? error.message : "โหลดรายการของฉันไม่สำเร็จ"))
      .finally(() => active && setLoadingMine(false));
    return () => { active = false; };
  }, []);

  const update = <K extends keyof ListingForm>(key: K, value: ListingForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const selectImages = (files: FileList | null) => {
    if (!files) return;
    setImageMessage("");
    const available = Math.max(0, MAX_IMAGES - selectedImages.length);
    const picked = Array.from(files).slice(0, available);
    const next: SelectedImage[] = [];
    const errors: string[] = [];
    for (const file of picked) {
      if (!CLIENT_IMAGE_TYPES.has(file.type)) {
        errors.push(`${file.name}: รองรับเฉพาะ JPEG, PNG, WebP`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        errors.push(`${file.name}: ต้องไม่เกิน 5 MB`);
        continue;
      }
      next.push({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) });
    }
    if (files.length > available) errors.push(`เลือกได้สูงสุด ${MAX_IMAGES} รูปต่อประกาศ`);
    setSelectedImages((current) => [...current, ...next]);
    if (errors.length) setImageMessage(errors.join(" · "));
  };

  const removeSelectedImage = (id: string) => {
    setSelectedImages((current) => {
      const removed = current.find((image) => image.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((image) => image.id !== id);
    });
  };

  const moveSelectedImage = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= selectedImages.length) return;
    const next = [...selectedImages];
    [next[index], next[target]] = [next[target], next[index]];
    setSelectedImages(next);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFieldErrors({});
    setMessage("");
    setImageMessage("");
    setCreated(null);

    try {
      const response = await fetch("/api/rental-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          category: form.category,
          description: form.description,
          condition: form.condition,
          hourlyRate: form.hourlyRate,
          dailyRate: form.dailyRate,
          minimumHours: form.minimumHours,
          depositAmount: form.depositAmount,
          urgentEnabled: form.urgentEnabled,
          urgentReservationFeeRate: Number(form.urgentFeePercent || 0) / 100,
          province: form.province,
          district: form.district,
          subdistrict: form.subdistrict,
          locationLabel: form.locationLabel,
          latitude: form.latitude,
          longitude: form.longitude,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        if (result.fieldErrors && typeof result.fieldErrors === "object") setFieldErrors(result.fieldErrors);
        setMessage(result.message ?? "สร้างประกาศไม่สำเร็จ");
        return;
      }

      const item = result.item as RentalListing;
      const uploadFailures = selectedImages.length ? await uploadImages(item.id, item.title, selectedImages) : [];
      selectedImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      setSelectedImages([]);
      setCreated(item);
      setImageRefreshKey((value) => value + 1);
      setForm(initialForm);
      setItems(await fetchMine());
      if (uploadFailures.length) {
        setImageMessage(`ประกาศถูกสร้างแล้ว แต่บางรูปอัปโหลดไม่สำเร็จ: ${uploadFailures.join(" · ")}`);
      }
    } catch {
      setMessage("เชื่อมต่อระบบสร้างประกาศไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 text-black">
      <header className="border-b border-black/10 bg-black px-4 py-4 text-white sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/" className="text-xl font-black sm:text-2xl">Borow <span className="text-[#D4AF37]">Borow</span></Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/rent" className="text-gray-300 hover:text-white">ดูของให้ยืม</Link>
            <Link href="/dashboard" className="hidden text-gray-300 hover:text-white sm:inline">แดชบอร์ด</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[1.35fr_0.65fr]">
        <section>
          <p className="text-xs font-bold tracking-[3px] text-[#B08D18] sm:text-sm">LEND YOUR ITEM</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">ลงของให้คนอื่นยืม</h1>
          <p className="mt-3 max-w-2xl leading-7 text-gray-500">สร้างประกาศจริงพร้อมรูป ราคาเช่ารายชั่วโมง/รายวัน เงินประกัน พื้นที่ และโหมดยืมด่วน</p>

          <form onSubmit={submit} className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-7 rounded-xl border border-[#D4AF37]/30 bg-[#fffaf0] p-4 text-sm leading-6">
              <b>🔐 Rental access + secure image storage</b>
              <p className="mt-1 text-gray-600">เจ้าของรายการมาจาก session ฝั่ง server และรูปจะเก็บใน Object Storage ส่วน PostgreSQL เก็บเฉพาะ storage key</p>
            </div>

            <div className="grid gap-5">
              <label className="text-sm font-bold">ชื่อสิ่งของ
                <input value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="เช่น กล้อง Sony A7III" className={inputClass} maxLength={120} />
                <FieldError message={fieldErrors.title} />
              </label>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="text-sm font-bold">หมวดหมู่
                  <select value={form.category} onChange={(event) => update("category", event.target.value)} className={inputClass}>
                    <option value="">เลือกหมวดหมู่</option>
                    {[
                      "อิเล็กทรอนิกส์", "กล้องและอุปกรณ์ถ่ายภาพ", "เกม", "แคมป์ปิ้ง", "เครื่องมือ", "กีฬา", "ยานพาหนะและอุปกรณ์", "อื่น ๆ",
                    ].map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                  <FieldError message={fieldErrors.category} />
                </label>
                <label className="text-sm font-bold">สภาพสิ่งของ
                  <select value={form.condition} onChange={(event) => update("condition", event.target.value as ListingForm["condition"])} className={inputClass}>
                    <option value="NEW">ใหม่</option><option value="LIKE_NEW">เหมือนใหม่</option><option value="GOOD">สภาพดี</option><option value="FAIR">พอใช้</option><option value="USED">มีร่องรอยการใช้งาน</option>
                  </select>
                  <FieldError message={fieldErrors.condition} />
                </label>
              </div>

              <label className="text-sm font-bold">รายละเอียด
                <textarea value={form.description} onChange={(event) => update("description", event.target.value)} rows={5} maxLength={3000} placeholder="อธิบายสภาพของ อุปกรณ์ที่ให้มาด้วย และเงื่อนไขการใช้งาน" className={inputClass} />
                <FieldError message={fieldErrors.description} />
              </label>

              <section className="rounded-2xl border border-gray-200 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div><h2 className="font-black">รูปสินค้า</h2><p className="mt-1 text-xs text-gray-500">JPEG / PNG / WebP · สูงสุด 8 รูป · ไม่เกิน 5 MB ต่อรูป · รูปแรกเป็นหน้าปก</p></div>
                  <span className="rounded-full bg-black px-3 py-1 text-xs font-bold text-white">{selectedImages.length}/8</span>
                </div>
                <label className="mt-4 flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm font-bold hover:border-[#D4AF37]">
                  + เลือกรูปจากเครื่อง / มือถือ
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => { selectImages(event.target.files); event.currentTarget.value = ""; }} />
                </label>
                {selectedImages.length ? (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {selectedImages.map((image, index) => (
                      <article key={image.id} className="overflow-hidden rounded-xl border bg-white">
                        <div className="relative aspect-square bg-gray-100">
                          <Image src={image.previewUrl} alt={`รูปที่เลือก ${index + 1}`} fill sizes="(max-width: 640px) 50vw, 180px" className="object-cover" unoptimized />
                          {index === 0 ? <span className="absolute left-2 top-2 rounded-full bg-[#D4AF37] px-2 py-1 text-[10px] font-black">หน้าปก</span> : null}
                        </div>
                        <div className="grid grid-cols-3 gap-1 p-2">
                          <button type="button" onClick={() => moveSelectedImage(index, -1)} disabled={index === 0} className="rounded border py-1 text-xs disabled:opacity-30">←</button>
                          <button type="button" onClick={() => moveSelectedImage(index, 1)} disabled={index === selectedImages.length - 1} className="rounded border py-1 text-xs disabled:opacity-30">→</button>
                          <button type="button" onClick={() => removeSelectedImage(image.id)} className="rounded border border-red-200 py-1 text-xs text-red-600">ลบ</button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
              </section>

              <section className="rounded-2xl bg-gray-50 p-4 sm:p-5">
                <h2 className="font-black">ราคาเช่า</h2><p className="mt-1 text-xs text-gray-500">ต้องมีรายชั่วโมงหรือรายวันอย่างน้อยหนึ่งแบบ</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-bold">ค่าเช่า / ชั่วโมง<input type="number" min="0" step="0.01" value={form.hourlyRate} onChange={(event) => update("hourlyRate", event.target.value)} placeholder="30" className={inputClass} /><FieldError message={fieldErrors.hourlyRate} /></label>
                  <label className="text-sm font-bold">ค่าเช่า / วัน<input type="number" min="0" step="0.01" value={form.dailyRate} onChange={(event) => update("dailyRate", event.target.value)} placeholder="300" className={inputClass} /><FieldError message={fieldErrors.dailyRate} /></label>
                </div>
                <FieldError message={fieldErrors.pricing} />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-bold">จำนวนชั่วโมงขั้นต่ำ<input type="number" min="1" max="168" step="1" value={form.minimumHours} onChange={(event) => update("minimumHours", event.target.value)} className={inputClass} /><FieldError message={fieldErrors.minimumHours} /></label>
                  <label className="text-sm font-bold">เงินประกัน<input type="number" min="0" step="0.01" value={form.depositAmount} onChange={(event) => update("depositAmount", event.target.value)} className={inputClass} /><FieldError message={fieldErrors.depositAmount} /></label>
                </div>
              </section>

              <section className="rounded-2xl border border-[#D4AF37]/40 bg-[#fffaf0] p-4 sm:p-5">
                <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={form.urgentEnabled} onChange={(event) => update("urgentEnabled", event.target.checked)} className="mt-1 h-5 w-5 accent-[#D4AF37]" /><span><b>⚡ เปิดยืมด่วน</b><span className="mt-1 block text-xs text-gray-600">ให้รายการนี้เข้าร่วมการค้นหาแบบเร่งด่วน</span></span></label>
                {form.urgentEnabled ? <label className="mt-4 block text-sm font-bold">ค่าจองผ่านแพลตฟอร์ม (%)<input type="number" min="0" max="100" step="0.1" value={form.urgentFeePercent} onChange={(event) => update("urgentFeePercent", event.target.value)} className={inputClass} /><FieldError message={fieldErrors.urgentReservationFeeRate} /></label> : null}
              </section>

              <section className="rounded-2xl bg-gray-50 p-4 sm:p-5">
                <h2 className="font-black">พื้นที่รับ-ส่ง</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <label className="text-sm font-bold">จังหวัด<input value={form.province} onChange={(event) => update("province", event.target.value)} placeholder="ชลบุรี" className={inputClass} /><FieldError message={fieldErrors.province} /></label>
                  <label className="text-sm font-bold">อำเภอ / เขต<input value={form.district} onChange={(event) => update("district", event.target.value)} placeholder="เมืองชลบุรี" className={inputClass} /><FieldError message={fieldErrors.district} /></label>
                  <label className="text-sm font-bold">ตำบล / แขวง<input value={form.subdistrict} onChange={(event) => update("subdistrict", event.target.value)} placeholder="แสนสุข" className={inputClass} /><FieldError message={fieldErrors.subdistrict} /></label>
                </div>
                <label className="mt-4 block text-sm font-bold">ชื่อจุดนัดหมายโดยประมาณ<input value={form.locationLabel} onChange={(event) => update("locationLabel", event.target.value)} placeholder="เช่น ใกล้มหาวิทยาลัย / ห้าง / สถานี" className={inputClass} /></label>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-bold">Latitude (ไม่บังคับ)<input type="number" min="-90" max="90" step="0.000001" value={form.latitude} onChange={(event) => update("latitude", event.target.value)} className={inputClass} /><FieldError message={fieldErrors.latitude} /></label>
                  <label className="text-sm font-bold">Longitude (ไม่บังคับ)<input type="number" min="-180" max="180" step="0.000001" value={form.longitude} onChange={(event) => update("longitude", event.target.value)} className={inputClass} /><FieldError message={fieldErrors.longitude} /></label>
                </div>
                <FieldError message={fieldErrors.locationCoordinates} />
              </section>

              {message ? <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{message}</p> : null}
              {imageMessage ? <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{imageMessage}</p> : null}
              {created ? <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"><b>สร้างประกาศสำเร็จ ✓</b><p className="mt-1">{created.title} และรูปที่อัปโหลดสำเร็จถูกบันทึกแล้ว</p></div> : null}

              <button type="submit" disabled={submitting} className="rounded-xl bg-[#D4AF37] px-5 py-4 font-black text-black transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "กำลังสร้างประกาศและอัปโหลดรูป..." : "สร้างประกาศให้ยืม"}</button>
            </div>
          </form>

          {created ? <ListingImageManager itemId={created.id} refreshKey={imageRefreshKey} /> : null}
        </section>

        <aside className="lg:pt-20">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-6">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold tracking-[2px] text-[#B08D18]">MY LISTINGS</p><h2 className="mt-1 text-xl font-black">รายการของฉัน</h2></div><span className="rounded-full bg-black px-3 py-1 text-xs font-bold text-white">{items.length}</span></div>
            {loadingMine ? <p className="mt-6 text-sm text-gray-500">กำลังโหลดจาก PostgreSQL...</p> : items.length === 0 ? <div className="mt-6 rounded-xl bg-gray-50 p-5 text-sm leading-6 text-gray-500">ยังไม่มีประกาศจริงในฐานข้อมูล</div> : (
              <div className="mt-5 grid gap-3">{items.slice(0, 8).map((item) => (
                <article key={item.id} className="rounded-xl border border-gray-200 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-bold">{item.title}</h3><p className="mt-1 text-xs text-gray-500">{item.category} · {item.province}</p></div><span className="rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-700">{item.status}</span></div><p className="mt-3 text-sm font-bold">{priceText(item)}</p><div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">{item.urgentEnabled ? <span className="rounded-full bg-[#fff3bf] px-2 py-1">⚡ ยืมด่วน</span> : null}<span>ประกัน {Number(item.depositAmount).toLocaleString("th-TH")} ฿</span></div></article>
              ))}</div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
