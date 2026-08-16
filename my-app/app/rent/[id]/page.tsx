import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/site-header";
import { BoltIcon, ChevronLeftIcon, ImageIcon, MapPinIcon, ShieldCheckIcon, StarIcon } from "@/components/ui/icons";
import { StatusPill } from "@/components/ui/primitives";
import { getPublicRentalItem } from "@/lib/rental/marketplace";
import { BookingForm } from "./booking-form";
import { UrgentBookingForm } from "./urgent-booking-form";

const money = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });
const conditionLabels: Record<string, string> = { NEW: "ใหม่", LIKE_NEW: "เหมือนใหม่", GOOD: "สภาพดี", FAIR: "พอใช้", USED: "มีร่องรอยใช้งาน" };

export default async function RentalDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getPublicRentalItem(id);
  if (!item) notFound();
  const location = [item.subdistrict, item.district, item.province].filter(Boolean).join(" · ");
  const urgentPercent = Number(item.urgentReservationFeeRate) * 100;

  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-4 pb-8 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pb-12">
        <Link href="/rent" className="mb-4 inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2 text-sm font-black text-[var(--muted-strong)] hover:bg-white"><ChevronLeftIcon size={17}/>กลับไปค้นหา</Link>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)] lg:gap-8">
          <section className="min-w-0">
            {item.images.length > 0 ? (
              <div className="hide-scrollbar flex snap-x gap-3 overflow-x-auto sm:grid sm:grid-cols-2 sm:overflow-visible">
                {item.images.map((image, index) => <div key={image.id} className={`relative aspect-[4/3] min-w-[88%] snap-center overflow-hidden rounded-[24px] bg-[var(--surface-2)] sm:min-w-0 ${index === 0 ? "sm:col-span-2" : ""}`}><Image src={image.contentUrl} alt={image.altText || item.title} fill unoptimized priority={index === 0} sizes={index === 0 ? "(max-width:1024px) 100vw,60vw" : "(max-width:640px) 88vw,30vw"} className="object-cover"/></div>)}
              </div>
            ) : <div className="grid aspect-[4/3] place-items-center rounded-[28px] border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]"><div className="text-center"><ImageIcon className="mx-auto" size={34}/><p className="mt-2 text-xs font-bold">ยังไม่มีรูปของรายการนี้</p></div></div>}

            <article className="mt-5 rounded-[28px] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-xs)] sm:p-7">
              <div className="flex flex-wrap items-center gap-2"><StatusPill tone="gold">{item.category}</StatusPill><StatusPill>{conditionLabels[item.condition]}</StatusPill>{item.urgentAvailableNow ? <StatusPill tone="gold"><span className="inline-flex items-center gap-1"><BoltIcon size={13}/>พร้อมยืมด่วน</span></StatusPill> : item.urgentEnabled ? <StatusPill>ยืมด่วนยังไม่ว่าง</StatusPill> : null}</div>
              <h1 className="mt-4 text-3xl font-black leading-tight tracking-[-0.045em] sm:text-4xl">{item.title}</h1>
              <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-[var(--muted-strong)] sm:text-base">{item.description}</p>
              <div className="mt-6 grid gap-3 border-t border-[var(--line)] pt-5 sm:grid-cols-2">
                <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--gold-strong)]"><MapPinIcon size={18}/></span><div><p className="text-xs font-bold text-[var(--muted)]">พื้นที่โดยประมาณ</p><p className="mt-1 text-sm font-black">{location}</p><p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">พิกัดนัดรับละเอียดไม่เปิดต่อสาธารณะ</p></div></div>
                <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--gold-strong)]"><ShieldCheckIcon size={18}/></span><div><p className="text-xs font-bold text-[var(--muted)]">ผู้ให้ยืม</p><p className="mt-1 flex items-center gap-1.5 text-sm font-black">{item.owner.displayName}{item.owner.verified && <ShieldCheckIcon size={14} className="text-[var(--gold-strong)]"/>}</p>{item.owner.ratingCount > 0 && <p className="mt-1 flex items-center gap-1 text-[11px] text-[var(--muted)]"><StarIcon size={12}/>{Number(item.owner.ratingAverage).toFixed(1)} · {item.owner.ratingCount} รีวิว</p>}</div></div>
              </div>
            </article>
          </section>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <section className="rounded-[28px] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
              <p className="bb-label">Rental options</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {item.hourlyRate && <div className="rounded-2xl bg-[var(--surface-2)] p-4"><p className="text-[11px] text-[var(--muted)]">รายชั่วโมง</p><p className="mt-1 text-xl font-black">฿{money.format(Number(item.hourlyRate))}<span className="ml-1 text-xs font-normal text-[var(--muted)]">/ชม.</span></p><p className="mt-1 text-[10px] text-[var(--muted)]">ขั้นต่ำ {item.minimumHours} ชม.</p></div>}
                {item.dailyRate && <div className="rounded-2xl bg-[var(--surface-2)] p-4"><p className="text-[11px] text-[var(--muted)]">รายวัน</p><p className="mt-1 text-xl font-black">฿{money.format(Number(item.dailyRate))}<span className="ml-1 text-xs font-normal text-[var(--muted)]">/วัน</span></p></div>}
              </div>
              <div className="mt-3 divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)] px-4"><div className="flex justify-between gap-4 py-3 text-sm"><span className="text-[var(--muted)]">เงินประกัน</span><b>฿{money.format(Number(item.depositAmount))}</b></div>{item.urgentEnabled && <div className="flex justify-between gap-4 py-3 text-sm"><span className="text-[var(--muted)]">ค่าจองยืมด่วน</span><b>{urgentPercent.toFixed(urgentPercent % 1 === 0 ? 0 : 1)}%</b></div>}</div>
              <BookingForm itemId={item.id} hourlyRate={item.hourlyRate} dailyRate={item.dailyRate} minimumHours={item.minimumHours} depositAmount={item.depositAmount}/>
              {item.urgentAvailableNow ? <UrgentBookingForm itemId={item.id} hourlyRate={item.hourlyRate} dailyRate={item.dailyRate} minimumHours={item.minimumHours} urgentFeeRate={item.urgentReservationFeeRate}/> : item.urgentEnabled ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-800">โหมดยืมด่วนเปิดอยู่ แต่ช่วงเวลาปัจจุบันมี block/booking ใช้งานอยู่ ลองจองแบบปกติหรือกลับมาภายหลัง</p> : null}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
