"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

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

const inputClass =
  "mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 font-normal outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs font-medium text-red-600">{message}</p>;
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
  if (!response.ok || !result.ok) {
    throw new Error(result.message ?? "โหลดรายการของฉันไม่สำเร็จ");
  }
  return result.items;
}

export default function LendForm() {
  const [form, setForm] = useState<ListingForm>(initialForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingMine, setLoadingMine] = useState(true);
  const [items, setItems] = useState<RentalListing[]>([]);
  const [created, setCreated] = useState<RentalListing | null>(null);

  useEffect(() => {
    let active = true;
    void fetchMine()
      .then((nextItems) => {
        if (active) setItems(nextItems);
      })
      .catch((error: unknown) => {
        if (active) setMessage(error instanceof Error ? error.message : "โหลดรายการของฉันไม่สำเร็จ");
      })
      .finally(() => {
        if (active) setLoadingMine(false);
      });
    return () => {
      active = false;
    };
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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setFieldErrors({});
    setMessage("");
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
          ownerId: "client-owner-id-is-never-trusted",
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        if (result.fieldErrors && typeof result.fieldErrors === "object") {
          setFieldErrors(result.fieldErrors);
        }
        setMessage(result.message ?? "สร้างประกาศไม่สำเร็จ");
        return;
      }

      setCreated(result.item);
      setForm(initialForm);
      const nextItems = await fetchMine();
      setItems(nextItems);
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
          <Link href="/" className="text-xl font-black sm:text-2xl">
            Borow <span className="text-[#D4AF37]">Borow</span>
          </Link>
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
          <p className="mt-3 max-w-2xl leading-7 text-gray-500">
            กำหนดราคาเช่ารายชั่วโมงหรือรายวัน เงินประกัน พื้นที่ และเปิดโหมดยืมด่วนได้จากประกาศเดียว
          </p>

          <form onSubmit={submit} className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-7 rounded-xl border border-[#D4AF37]/30 bg-[#fffaf0] p-4 text-sm leading-6">
              <b>🔐 บัญชีนี้ผ่าน Rental access แล้ว</b>
              <p className="mt-1 text-gray-600">Server จะใช้ owner จาก session เท่านั้น และไม่เชื่อ owner ID ที่ส่งมาจาก browser</p>
            </div>

            <div className="grid gap-5">
              <label className="text-sm font-bold">
                ชื่อสิ่งของ
                <input
                  value={form.title}
                  onChange={(event) => update("title", event.target.value)}
                  placeholder="เช่น กล้อง Sony A7III"
                  className={inputClass}
                  maxLength={120}
                />
                <FieldError message={fieldErrors.title} />
              </label>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="text-sm font-bold">
                  หมวดหมู่
                  <select value={form.category} onChange={(event) => update("category", event.target.value)} className={inputClass}>
                    <option value="">เลือกหมวดหมู่</option>
                    <option value="อิเล็กทรอนิกส์">อิเล็กทรอนิกส์</option>
                    <option value="กล้องและอุปกรณ์ถ่ายภาพ">กล้องและอุปกรณ์ถ่ายภาพ</option>
                    <option value="เกม">เกม</option>
                    <option value="แคมป์ปิ้ง">แคมป์ปิ้ง</option>
                    <option value="เครื่องมือ">เครื่องมือ</option>
                    <option value="กีฬา">กีฬา</option>
                    <option value="ยานพาหนะและอุปกรณ์">ยานพาหนะและอุปกรณ์</option>
                    <option value="อื่น ๆ">อื่น ๆ</option>
                  </select>
                  <FieldError message={fieldErrors.category} />
                </label>

                <label className="text-sm font-bold">
                  สภาพสิ่งของ
                  <select value={form.condition} onChange={(event) => update("condition", event.target.value as ListingForm["condition"])} className={inputClass}>
                    <option value="NEW">ใหม่</option>
                    <option value="LIKE_NEW">เหมือนใหม่</option>
                    <option value="GOOD">สภาพดี</option>
                    <option value="FAIR">พอใช้</option>
                    <option value="USED">มีร่องรอยการใช้งาน</option>
                  </select>
                  <FieldError message={fieldErrors.condition} />
                </label>
              </div>

              <label className="text-sm font-bold">
                รายละเอียด
                <textarea
                  value={form.description}
                  onChange={(event) => update("description", event.target.value)}
                  rows={5}
                  maxLength={3000}
                  placeholder="อธิบายสภาพของ อุปกรณ์ที่ให้มาด้วย และเงื่อนไขการใช้งาน"
                  className={inputClass}
                />
                <FieldError message={fieldErrors.description} />
              </label>

              <div className="rounded-2xl bg-gray-50 p-4 sm:p-5">
                <h2 className="font-black">ราคาเช่า</h2>
                <p className="mt-1 text-xs text-gray-500">ต้องกำหนดอย่างน้อยหนึ่งแบบ: รายชั่วโมง หรือ รายวัน</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-bold">
                    ค่าเช่า / ชั่วโมง
                    <input type="number" min="0" step="0.01" value={form.hourlyRate} onChange={(event) => update("hourlyRate", event.target.value)} placeholder="30" className={inputClass} />
                    <FieldError message={fieldErrors.hourlyRate} />
                  </label>
                  <label className="text-sm font-bold">
                    ค่าเช่า / วัน
                    <input type="number" min="0" step="0.01" value={form.dailyRate} onChange={(event) => update("dailyRate", event.target.value)} placeholder="300" className={inputClass} />
                    <FieldError message={fieldErrors.dailyRate} />
                  </label>
                </div>
                <FieldError message={fieldErrors.pricing} />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-bold">
                    จำนวนชั่วโมงขั้นต่ำ
                    <input type="number" min="1" max="168" step="1" value={form.minimumHours} onChange={(event) => update("minimumHours", event.target.value)} className={inputClass} />
                    <FieldError message={fieldErrors.minimumHours} />
                  </label>
                  <label className="text-sm font-bold">
                    เงินประกัน
                    <input type="number" min="0" step="0.01" value={form.depositAmount} onChange={(event) => update("depositAmount", event.target.value)} className={inputClass} />
                    <FieldError message={fieldErrors.depositAmount} />
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-[#D4AF37]/40 bg-[#fffaf0] p-4 sm:p-5">
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={form.urgentEnabled} onChange={(event) => update("urgentEnabled", event.target.checked)} className="mt-1 h-5 w-5 accent-[#D4AF37]" />
                  <span>
                    <b>⚡ เปิดยืมด่วน</b>
                    <span className="mt-1 block text-xs leading-5 text-gray-600">ให้รายการนี้เข้าร่วมการค้นหาของใกล้ตัวแบบเร่งด่วน</span>
                  </span>
                </label>
                {form.urgentEnabled ? (
                  <label className="mt-4 block text-sm font-bold">
                    ค่าจองผ่านแพลตฟอร์ม (%)
                    <input type="number" min="0" max="100" step="0.1" value={form.urgentFeePercent} onChange={(event) => update("urgentFeePercent", event.target.value)} className={inputClass} />
                    <FieldError message={fieldErrors.urgentReservationFeeRate} />
                  </label>
                ) : null}
              </div>

              <div className="rounded-2xl bg-gray-50 p-4 sm:p-5">
                <h2 className="font-black">พื้นที่รับ-ส่ง</h2>
                <p className="mt-1 text-xs leading-5 text-gray-500">หน้า Marketplace จะใช้ข้อมูลพื้นที่นี้สำหรับ province/district/subdistrict และค้นหาใกล้ตัวใน Phase ถัดไป</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <label className="text-sm font-bold">
                    จังหวัด
                    <input value={form.province} onChange={(event) => update("province", event.target.value)} placeholder="ชลบุรี" className={inputClass} />
                    <FieldError message={fieldErrors.province} />
                  </label>
                  <label className="text-sm font-bold">
                    อำเภอ / เขต
                    <input value={form.district} onChange={(event) => update("district", event.target.value)} placeholder="เมืองชลบุรี" className={inputClass} />
                    <FieldError message={fieldErrors.district} />
                  </label>
                  <label className="text-sm font-bold">
                    ตำบล / แขวง
                    <input value={form.subdistrict} onChange={(event) => update("subdistrict", event.target.value)} placeholder="แสนสุข" className={inputClass} />
                    <FieldError message={fieldErrors.subdistrict} />
                  </label>
                </div>
                <label className="mt-4 block text-sm font-bold">
                  ชื่อจุดนัดหมายโดยประมาณ
                  <input value={form.locationLabel} onChange={(event) => update("locationLabel", event.target.value)} placeholder="เช่น ใกล้มหาวิทยาลัย / ห้าง / สถานี" className={inputClass} />
                  <FieldError message={fieldErrors.locationLabel} />
                </label>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-bold">
                    Latitude (ไม่บังคับ)
                    <input type="number" min="-90" max="90" step="0.000001" value={form.latitude} onChange={(event) => update("latitude", event.target.value)} placeholder="13.361143" className={inputClass} />
                    <FieldError message={fieldErrors.latitude} />
                  </label>
                  <label className="text-sm font-bold">
                    Longitude (ไม่บังคับ)
                    <input type="number" min="-180" max="180" step="0.000001" value={form.longitude} onChange={(event) => update("longitude", event.target.value)} placeholder="100.984673" className={inputClass} />
                    <FieldError message={fieldErrors.longitude} />
                  </label>
                </div>
                <FieldError message={fieldErrors.locationCoordinates} />
              </div>

              <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                📷 การอัปโหลดรูปจะเชื่อม Object Storage ใน TASK 9 เพื่อไม่ให้รูปถูกเก็บเป็น mock/base64 ใน PostgreSQL
              </div>

              {message ? <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{message}</p> : null}
              {created ? (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                  <b>สร้างประกาศสำเร็จ ✓</b>
                  <p className="mt-1">{created.title} ถูกบันทึกลง PostgreSQL แล้ว (ID: {created.id})</p>
                </div>
              ) : null}

              <button type="submit" disabled={submitting} className="rounded-xl bg-[#D4AF37] px-5 py-4 font-black text-black transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50">
                {submitting ? "กำลังบันทึกประกาศ..." : "สร้างประกาศให้ยืม"}
              </button>
            </div>
          </form>
        </section>

        <aside className="lg:pt-20">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold tracking-[2px] text-[#B08D18]">MY LISTINGS</p>
                <h2 className="mt-1 text-xl font-black">รายการของฉัน</h2>
              </div>
              <span className="rounded-full bg-black px-3 py-1 text-xs font-bold text-white">{items.length}</span>
            </div>

            {loadingMine ? (
              <p className="mt-6 text-sm text-gray-500">กำลังโหลดจาก PostgreSQL...</p>
            ) : items.length === 0 ? (
              <div className="mt-6 rounded-xl bg-gray-50 p-5 text-sm leading-6 text-gray-500">ยังไม่มีประกาศจริงในฐานข้อมูล สร้างรายการแรกจากฟอร์มนี้ได้เลย</div>
            ) : (
              <div className="mt-5 grid gap-3">
                {items.slice(0, 8).map((item) => (
                  <article key={item.id} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-bold">{item.title}</h3>
                        <p className="mt-1 text-xs text-gray-500">{item.category} · {item.province}</p>
                      </div>
                      <span className="rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-700">{item.status}</span>
                    </div>
                    <p className="mt-3 text-sm font-bold">{priceText(item)}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                      {item.urgentEnabled ? <span className="rounded-full bg-[#fff3bf] px-2 py-1">⚡ ยืมด่วน</span> : null}
                      <span>ประกัน {Number(item.depositAmount).toLocaleString("th-TH")} ฿</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
