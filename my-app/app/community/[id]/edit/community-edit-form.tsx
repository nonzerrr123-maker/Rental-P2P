"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentBrowserLocation } from "@/lib/browser-geolocation";
import { communityRequestFormSchema, type CommunityRequestFormInput } from "@/lib/forms/rental-actions";
import type { CommunityRequestRecord } from "@/lib/community/service";

const inputClass = "mt-2 min-h-12";
const categories = ["อิเล็กทรอนิกส์","กล้องและอุปกรณ์ถ่ายภาพ","เกม","แคมป์ปิ้ง","เครื่องมือ","กีฬา","ยานพาหนะและอุปกรณ์","อื่น ๆ"];

function localInput(iso: string): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Bangkok",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
  return parts.replace(" ", "T");
}

export default function CommunityEditForm({ item }: { item: CommunityRequestRecord }) {
  const router = useRouter();
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");
  const [serverErrors, setServerErrors] = useState<Record<string,string>>({});
  const [coords, setCoords] = useState<{latitude?: string; longitude?: string}>({});
  const [saved, setSaved] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty } } = useForm<CommunityRequestFormInput>({
    resolver: zodResolver(communityRequestFormSchema),
    defaultValues: {
      title: item.title,
      category: item.category,
      description: item.description ?? "",
      targetPrice: item.targetPrice ?? "",
      neededStartsAt: localInput(item.neededStartsAt),
      neededEndsAt: localInput(item.neededEndsAt),
      province: item.province,
      district: item.district ?? "",
      subdistrict: item.subdistrict ?? "",
      isUrgent: item.isUrgent,
    },
  });

  const dirty = isDirty || Boolean(coords.latitude);
  useEffect(() => {
    if (!dirty || saved) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, saved]);

  const readLocation = async () => {
    setLocating(true); setMessage("");
    try {
      const result = await getCurrentBrowserLocation();
      setCoords({ latitude: result.latitude.toFixed(6), longitude: result.longitude.toFixed(6) });
      setMessage(`อ่านตำแหน่งใหม่แล้ว ±${Math.round(result.accuracy)} เมตร จะใช้หลังบันทึก`);
    } catch (error) {
      setMessage(error && typeof error === "object" && "message" in error ? String(error.message) : "อ่านตำแหน่งไม่สำเร็จ");
    } finally { setLocating(false); }
  };

  const submit = handleSubmit(async (values) => {
    setMessage(""); setServerErrors({}); setSaved(false);
    try {
      const payload: Record<string, unknown> = {
        ...values,
        neededStartsAt: new Date(values.neededStartsAt).toISOString(),
        neededEndsAt: new Date(values.neededEndsAt).toISOString(),
      };
      if (coords.latitude && coords.longitude) {
        payload.latitude = coords.latitude;
        payload.longitude = coords.longitude;
      }
      const response = await fetch(`/api/community-requests/${item.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        if (result.fieldErrors && typeof result.fieldErrors === "object") setServerErrors(result.fieldErrors);
        setMessage(result.message ?? "แก้ไขโพสต์ไม่สำเร็จ");
        return;
      }
      setSaved(true);
      router.push(`/community/${item.id}`);
      router.refresh();
    } catch {
      setMessage("เชื่อมต่อระบบแก้ไขคอมมูไม่สำเร็จ กรุณาลองอีกครั้ง");
    }
  });

  const fieldError = (name: keyof CommunityRequestFormInput) => errors[name]?.message || serverErrors[name];
  return <form onSubmit={submit} className="rounded-[28px] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-7" noValidate>
    {item.offerCount > 0 && <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800"><b>มีข้อเสนอรออยู่ {item.offerCount} รายการ</b><br/>ถ้าแก้เวลา งบ พื้นที่ หรือข้อมูลสำคัญ ระบบจะแจ้งผู้เสนอให้กลับมาตรวจข้อเสนออีกครั้ง แต่จะไม่ลบข้อเสนอเดิมอัตโนมัติ</div>}
    <div className="grid gap-5">
      <label className="text-sm font-bold">ของที่กำลังหา<input {...register("title")} maxLength={120} className={`bb-input ${inputClass}`}/><FormMessage>{fieldError("title")}</FormMessage></label>
      <div className="grid gap-5 md:grid-cols-2"><label className="text-sm font-bold">หมวดหมู่<Select {...register("category")} className={inputClass}><option value="">เลือกหมวดหมู่</option>{categories.map(v=><option key={v}>{v}</option>)}</Select><FormMessage>{fieldError("category")}</FormMessage></label><label className="text-sm font-bold">งบเป้าหมาย<input {...register("targetPrice")} type="number" min="0" max="10000000" step="0.01" className={`bb-input ${inputClass}`}/><FormMessage>{fieldError("targetPrice")}</FormMessage></label></div>
      <label className="text-sm font-bold">รายละเอียด<Textarea {...register("description")} rows={5} maxLength={3000} className="mt-2"/><FormMessage>{fieldError("description")}</FormMessage></label>
      <section className="rounded-2xl bg-[var(--surface-2)] p-4"><h2 className="font-black">ช่วงเวลาที่ต้องการ</h2><div className="mt-3 grid gap-4 md:grid-cols-2"><label className="text-sm font-bold">เริ่มใช้<input {...register("neededStartsAt")} type="datetime-local" className={`bb-input ${inputClass}`}/><FormMessage>{fieldError("neededStartsAt")}</FormMessage></label><label className="text-sm font-bold">คืน / สิ้นสุด<input {...register("neededEndsAt")} type="datetime-local" className={`bb-input ${inputClass}`}/><FormMessage>{fieldError("neededEndsAt")}</FormMessage></label></div></section>
      <section className="rounded-2xl bg-[var(--surface-2)] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black">พื้นที่ที่สะดวกรับของ</h2><p className="mt-1 text-xs text-[var(--muted)]">ถ้าไม่อ่าน GPS ใหม่ ระบบจะเก็บพิกัดเดิมไว้</p></div><Button type="button" variant="outline" disabled={locating} onClick={()=>void readLocation()}>{locating?"กำลังอ่านตำแหน่ง...":"📍 อัปเดตตำแหน่ง"}</Button></div><div className="mt-3 grid gap-4 md:grid-cols-3"><label className="text-sm font-bold">จังหวัด<input {...register("province")} className={`bb-input ${inputClass}`}/><FormMessage>{fieldError("province")}</FormMessage></label><label className="text-sm font-bold">อำเภอ / เขต<input {...register("district")} className={`bb-input ${inputClass}`}/></label><label className="text-sm font-bold">ตำบล / แขวง<input {...register("subdistrict")} className={`bb-input ${inputClass}`}/></label></div></section>
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--gold-line)] bg-[var(--gold-soft)] p-4"><input {...register("isUrgent")} type="checkbox" className="mt-1 h-5 w-5 accent-[#c9a227]"/><span><b>⚡ ต้องการด่วน</b><span className="mt-1 block text-xs text-[var(--muted-strong)]">ปรับสถานะด่วนได้ตราบใดที่โพสต์ยัง OPEN</span></span></label>
      {message && <p role="status" className="rounded-xl bg-[var(--surface-2)] p-4 text-sm font-semibold">{message}</p>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Link href={`/community/${item.id}`} className="rounded-xl border border-[var(--line)] px-5 py-3 text-center text-sm font-bold">ยกเลิก</Link><Button type="submit" disabled={isSubmitting || !dirty}>{isSubmitting?"กำลังบันทึก...":"บันทึกการแก้ไข"}</Button></div>
    </div>
  </form>;
}
