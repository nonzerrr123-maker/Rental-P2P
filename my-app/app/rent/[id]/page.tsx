import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicRentalItem } from "@/lib/rental/marketplace";

const money = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });

const conditionLabels: Record<string, string> = {
  NEW: "ใหม่",
  LIKE_NEW: "เหมือนใหม่",
  GOOD: "สภาพดี",
  FAIR: "พอใช้",
  USED: "มีร่องรอยใช้งาน",
};

export default async function RentalDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getPublicRentalItem(id);
  if (!item) notFound();

  const location = [item.subdistrict, item.district, item.province].filter(Boolean).join(" · ");
  const urgentPercent = Number(item.urgentReservationFeeRate) * 100;

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-neutral-950">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/rent" className="text-sm font-bold text-neutral-500 hover:text-neutral-950">← กลับ Marketplace</Link>
          <Link href="/" className="text-2xl font-black">Borow Borow<span className="text-[#c9a227]">.</span></Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)] lg:py-12">
        <section>
          {item.images.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {item.images.map((image, index) => (
                <div key={image.id} className={`relative overflow-hidden rounded-3xl bg-neutral-100 ${index === 0 ? "aspect-[4/3] sm:col-span-2" : "aspect-[4/3]"}`}>
                  <Image
                    src={image.contentUrl}
                    alt={image.altText || item.title}
                    fill
                    unoptimized
                    priority={index === 0}
                    sizes={index === 0 ? "(max-width: 1024px) 100vw, 60vw" : "(max-width: 640px) 100vw, 30vw"}
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid aspect-[4/3] place-items-center rounded-3xl border bg-white text-7xl text-neutral-300">📦</div>
          )}

          <article className="mt-6 rounded-3xl border border-neutral-200 bg-white p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#faf5df] px-3 py-1 text-xs font-black text-[#84680c]">{item.category}</span>
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold">{conditionLabels[item.condition]}</span>
              {item.urgentEnabled && <span className="rounded-full bg-neutral-950 px-3 py-1 text-xs font-black text-white">⚡ ยืมด่วน</span>}
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">{item.title}</h1>
            <p className="mt-5 whitespace-pre-wrap leading-7 text-neutral-600">{item.description}</p>
          </article>
        </section>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm md:p-7">
            <p className="text-xs font-black tracking-[0.2em] text-[#9d7d13]">RENTAL OPTIONS</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {item.hourlyRate && (
                <div className="rounded-2xl bg-neutral-50 p-4">
                  <p className="text-xs text-neutral-500">รายชั่วโมง</p>
                  <p className="mt-1 text-2xl font-black">฿{money.format(Number(item.hourlyRate))}<span className="text-sm font-normal text-neutral-500"> / ชม.</span></p>
                  <p className="mt-1 text-xs text-neutral-500">ขั้นต่ำ {item.minimumHours} ชั่วโมง</p>
                </div>
              )}
              {item.dailyRate && (
                <div className="rounded-2xl bg-neutral-50 p-4">
                  <p className="text-xs text-neutral-500">รายวัน</p>
                  <p className="mt-1 text-2xl font-black">฿{money.format(Number(item.dailyRate))}<span className="text-sm font-normal text-neutral-500"> / วัน</span></p>
                </div>
              )}
            </div>

            <div className="mt-4 rounded-2xl border p-4">
              <div className="flex justify-between gap-4 text-sm"><span className="text-neutral-500">เงินประกัน</span><b>฿{money.format(Number(item.depositAmount))}</b></div>
              {item.urgentEnabled && (
                <div className="mt-3 flex justify-between gap-4 border-t pt-3 text-sm"><span className="text-neutral-500">ค่าจองยืมด่วน</span><b>{urgentPercent.toFixed(urgentPercent % 1 === 0 ? 0 : 1)}%</b></div>
              )}
            </div>

            <div className="mt-5 rounded-2xl border p-4">
              <p className="text-xs font-bold text-neutral-500">พื้นที่โดยประมาณ</p>
              <p className="mt-1 font-black">📍 {location}</p>
              <p className="mt-2 text-xs text-neutral-400">ที่อยู่/พิกัดนัดรับแบบละเอียดจะไม่แสดงสาธารณะก่อนยืนยันการเช่า</p>
            </div>

            <div className="mt-5 rounded-2xl border p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-black">{item.owner.displayName}</p>
                  <p className="mt-1 text-sm text-neutral-500">
                    {item.owner.verified ? "✓ ยืนยันตัวตนแล้ว" : "ยังไม่ยืนยันตัวตน"}
                    {item.owner.ratingCount > 0 && ` · ⭐ ${Number(item.owner.ratingAverage).toFixed(1)} (${item.owner.ratingCount})`}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled
              className="mt-6 w-full cursor-not-allowed rounded-2xl bg-neutral-950 px-5 py-4 font-black text-white opacity-55"
            >
              ขอยืม — เปิดใน Booking Phase
            </button>
            <p className="mt-3 text-center text-xs text-neutral-400">หน้านี้แสดงข้อมูลจริงแล้ว แต่ยังไม่สร้างคำขอปลอมก่อนระบบ Booking/Availability พร้อม</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
