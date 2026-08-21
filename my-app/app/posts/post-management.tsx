"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BoltIcon,
  ChevronRightIcon,
  ClockIcon,
  MapPinIcon,
  PackageIcon,
  PlusIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { StatusPill } from "@/components/ui/primitives";
import type { RentalListing } from "@/lib/rental/listings";
import type { PublicCommunityRequest } from "@/lib/community/service";

type Tab = "ALL" | "RENTAL" | "COMMUNITY";
const money = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

const rentalStatusLabels: Record<string,string> = { ACTIVE:"เปิดอยู่", PAUSED:"พักประกาศ", UNAVAILABLE:"ไม่พร้อม", ARCHIVED:"เก็บถาวร" };
const communityStatusLabels: Record<string,string> = { OPEN:"เปิดรับข้อเสนอ", MATCHED:"จับคู่แล้ว", CLOSED:"ปิดแล้ว", CANCELLED:"ยกเลิก", EXPIRED:"หมดอายุ" };

export default function PostManagement({
  initialRentals,
  initialCommunity,
}: {
  initialRentals: RentalListing[];
  initialCommunity: PublicCommunityRequest[];
}) {
  const router = useRouter();
  const [rentals, setRentals] = useState(initialRentals);
  const [community, setCommunity] = useState(initialCommunity);
  const [tab, setTab] = useState<Tab>("ALL");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const counts = useMemo(() => ({ all: rentals.length + community.length, rental: rentals.length, community: community.length }), [rentals, community]);

  const updateRentalStatus = async (item: RentalListing, action: "PAUSE"|"RESUME"|"ARCHIVE"|"RESTORE") => {
    setBusy(`rental:${item.id}`); setMessage("");
    try {
      const response = await fetch(`/api/rental-items/${item.id}/status`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "อัปเดตสถานะประกาศไม่สำเร็จ");
      setRentals((current) => current.map((entry) => entry.id === item.id ? result.item : entry));
      setMessage("อัปเดตสถานะประกาศแล้ว");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "อัปเดตสถานะประกาศไม่สำเร็จ");
    } finally { setBusy(""); }
  };

  const updateCommunityStatus = async (item: PublicCommunityRequest, action: "CLOSE"|"CANCEL") => {
    setBusy(`community:${item.id}`); setMessage("");
    try {
      const response = await fetch(`/api/community-requests/${item.id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "อัปเดตโพสต์ไม่สำเร็จ");
      setCommunity((current) => current.map((entry) => entry.id === item.id ? result.request : entry));
      setMessage(action === "CLOSE" ? "ปิดรับข้อเสนอแล้ว" : "ยกเลิกโพสต์แล้ว");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "อัปเดตโพสต์ไม่สำเร็จ");
    } finally { setBusy(""); }
  };

  const showRental = tab === "ALL" || tab === "RENTAL";
  const showCommunity = tab === "ALL" || tab === "COMMUNITY";

  return <div>
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="ประเภทโพสต์">
      {([
        ["ALL", `ทั้งหมด ${counts.all}`],
        ["RENTAL", `ของให้ยืม ${counts.rental}`],
        ["COMMUNITY", `โพสต์หาของ ${counts.community}`],
      ] as [Tab,string][]).map(([value,label]) => <button key={value} type="button" role="tab" aria-selected={tab===value} onClick={()=>setTab(value)} className={`rounded-full px-4 py-2 text-xs font-black transition ${tab===value?"bg-[var(--ink)] text-white":"border border-[var(--line)] bg-white text-[var(--muted-strong)] hover:border-[var(--gold-line)]"}`}>{label}</button>)}
    </div>

    {message && <p role="status" className="mt-4 rounded-xl border border-[var(--line)] bg-white p-3 text-sm font-semibold">{message}</p>}

    {showRental && <section className="mt-7">
      <div className="flex items-end justify-between gap-4"><div><p className="bb-label">Rental listings</p><h2 className="mt-1 text-xl font-black">ของที่ฉันปล่อยยืม</h2></div><Link href="/lend" className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--gold)] px-4 py-2.5 text-xs font-black"><PlusIcon size={15}/>ลงของ</Link></div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {rentals.map((item) => {
          const isBusy = busy === `rental:${item.id}`;
          const location = [item.subdistrict,item.district,item.province].filter(Boolean).join(" · ");
          return <article key={item.id} className="rounded-[22px] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-xs)]">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap gap-2"><StatusPill>{rentalStatusLabels[item.status]??item.status}</StatusPill>{item.urgentEnabled&&<StatusPill tone="gold"><span className="inline-flex items-center gap-1"><BoltIcon size={11}/>ยืมด่วน</span></StatusPill>}</div><h3 className="mt-3 truncate text-lg font-black">{item.title}</h3></div><PackageIcon className="shrink-0 text-[var(--muted)]"/></div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--muted)]"><MapPinIcon size={13}/>{location}</p>
            <p className="mt-2 text-xs font-bold text-[var(--muted-strong)]">{item.hourlyRate?`฿${money.format(Number(item.hourlyRate))}/ชม.`:""}{item.hourlyRate&&item.dailyRate?" · ":""}{item.dailyRate?`฿${money.format(Number(item.dailyRate))}/วัน`:""}</p>
            <p className="mt-2 text-[10px] text-[var(--muted)]">แก้ไขล่าสุด {dateTime.format(new Date(item.updatedAt))}</p>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--line)] pt-4">
              {item.status!=="ARCHIVED"&&<Link href={`/lend/${item.id}/edit`} className="rounded-xl border border-[var(--line)] px-3 py-2 text-xs font-black">แก้ไข</Link>}
              <Link href={`/rent/${item.id}`} className="rounded-xl border border-[var(--line)] px-3 py-2 text-xs font-black">ดูประกาศ</Link>
              <Link href="/lend/location" className="rounded-xl border border-[var(--line)] px-3 py-2 text-xs font-black">ตำแหน่ง</Link>
              {item.status==="ACTIVE"&&<button disabled={isBusy} onClick={()=>void updateRentalStatus(item,"PAUSE")} className="rounded-xl border border-[var(--line)] px-3 py-2 text-xs font-black disabled:opacity-40">พัก</button>}
              {item.status==="PAUSED"&&<button disabled={isBusy} onClick={()=>void updateRentalStatus(item,"RESUME")} className="rounded-xl bg-[var(--ink)] px-3 py-2 text-xs font-black text-white disabled:opacity-40">เปิดกลับ</button>}
              {item.status!=="ARCHIVED"&&<button disabled={isBusy} onClick={()=>void updateRentalStatus(item,"ARCHIVE")} className="rounded-xl px-3 py-2 text-xs font-black text-red-600 disabled:opacity-40">เก็บถาวร</button>}
              {item.status==="ARCHIVED"&&<button disabled={isBusy} onClick={()=>void updateRentalStatus(item,"RESTORE")} className="rounded-xl bg-[var(--ink)] px-3 py-2 text-xs font-black text-white disabled:opacity-40">กู้ประกาศ</button>}
            </div>
          </article>;
        })}
        {!rentals.length && <div className="rounded-[22px] border border-dashed border-[var(--line-strong)] p-8 text-center text-sm text-[var(--muted)]">ยังไม่มีของให้ยืม</div>}
      </div>
    </section>}

    {showCommunity && <section className="mt-9">
      <div className="flex items-end justify-between gap-4"><div><p className="bb-label">Community requests</p><h2 className="mt-1 text-xl font-black">โพสต์หาของของฉัน</h2></div><Link href="/community/new" className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-xs font-black text-white"><PlusIcon size={15}/>โพสต์หา</Link></div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {community.map((item) => {
          const isBusy = busy === `community:${item.id}`;
          return <article key={item.id} className="rounded-[22px] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-xs)]">
            <div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><StatusPill>{communityStatusLabels[item.status]??item.status}</StatusPill>{item.isUrgent&&<StatusPill tone="gold">ด่วน</StatusPill>}</div><h3 className="mt-3 text-lg font-black">{item.title}</h3></div><UsersIcon className="shrink-0 text-[var(--muted)]"/></div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--muted)]"><ClockIcon size={13}/>{dateTime.format(new Date(item.neededStartsAt))} → {dateTime.format(new Date(item.neededEndsAt))}</p>
            <p className="mt-2 text-xs font-bold text-[var(--muted-strong)]">{item.targetPrice?`งบ ฿${money.format(Number(item.targetPrice))}`:"เปิดรับราคา"} · {item.offerCount} ข้อเสนอ</p>
            <p className="mt-2 text-[10px] text-[var(--muted)]">แก้ไขล่าสุด {dateTime.format(new Date(item.updatedAt))}</p>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--line)] pt-4">
              {item.status==="OPEN"&&<Link href={`/community/${item.id}/edit`} className="rounded-xl border border-[var(--line)] px-3 py-2 text-xs font-black">แก้ไข</Link>}
              <Link href={`/community/${item.id}`} className="rounded-xl border border-[var(--line)] px-3 py-2 text-xs font-black">ดูโพสต์</Link>
              {item.status==="OPEN"&&<button disabled={isBusy} onClick={()=>void updateCommunityStatus(item,"CLOSE")} className="rounded-xl border border-[var(--line)] px-3 py-2 text-xs font-black disabled:opacity-40">ปิดรับข้อเสนอ</button>}
              {item.status==="OPEN"&&<button disabled={isBusy} onClick={()=>void updateCommunityStatus(item,"CANCEL")} className="rounded-xl px-3 py-2 text-xs font-black text-red-600 disabled:opacity-40">ยกเลิกโพสต์</button>}
            </div>
          </article>;
        })}
        {!community.length && <div className="rounded-[22px] border border-dashed border-[var(--line-strong)] p-8 text-center text-sm text-[var(--muted)]">ยังไม่มีโพสต์หาของ</div>}
      </div>
    </section>}

    {!counts.all && <div className="mt-8 rounded-[28px] border border-dashed border-[var(--line-strong)] bg-white p-10 text-center"><h2 className="text-xl font-black">ยังไม่มีโพสต์</h2><p className="mt-2 text-sm text-[var(--muted)]">เริ่มจากลงของให้ยืม หรือโพสต์หาของที่คุณต้องการ</p><div className="mt-5 flex flex-wrap justify-center gap-2"><Link href="/lend" className="inline-flex items-center gap-1 rounded-xl bg-[var(--gold)] px-4 py-3 text-sm font-black"><PackageIcon size={16}/>ลงของ</Link><Link href="/community/new" className="inline-flex items-center gap-1 rounded-xl bg-[var(--ink)] px-4 py-3 text-sm font-black text-white"><UsersIcon size={16}/>โพสต์หาของ</Link></div></div>}

    <Link href="/dashboard" className="mt-8 inline-flex items-center gap-1.5 text-sm font-black text-[var(--muted-strong)] hover:text-[var(--ink)]">ไป Dashboard ธุรกรรม<ChevronRightIcon size={16}/></Link>
  </div>;
}
