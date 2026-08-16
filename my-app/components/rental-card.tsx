import Image from "next/image";
import Link from "next/link";
import type { PublicRentalCard } from "@/lib/rental/marketplace";
import { BoltIcon, ImageIcon, MapPinIcon, ShieldCheckIcon, StarIcon } from "@/components/ui/icons";
import { StatusPill } from "@/components/ui/primitives";

const money = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });
const conditionLabels: Record<string, string> = {
  NEW: "ใหม่",
  LIKE_NEW: "เหมือนใหม่",
  GOOD: "สภาพดี",
  FAIR: "พอใช้",
  USED: "มีร่องรอย",
};

function locationText(item: Pick<PublicRentalCard, "province" | "district" | "subdistrict">) {
  return [item.subdistrict, item.district, item.province].filter(Boolean).join(" · ");
}

export default function RentalCard({ item, priority = false }: { item: PublicRentalCard; priority?: boolean }) {
  return (
    <article className="group min-w-0 overflow-hidden rounded-[22px] border border-[var(--line)] bg-white shadow-[var(--shadow-xs)] transition hover:-translate-y-0.5 hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-card)]">
      <Link href={`/rent/${item.id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-[var(--surface-2)]">
          {item.coverImageUrl ? (
            <Image src={item.coverImageUrl} alt={item.title} fill unoptimized priority={priority} sizes="(max-width: 640px) 76vw, (max-width: 1024px) 40vw, 25vw" className="object-cover transition duration-300 group-hover:scale-[1.02]"/>
          ) : (
            <div className="grid h-full place-items-center text-[var(--muted)]">
              <div className="grid h-14 w-14 place-items-center rounded-2xl border border-[var(--line)] bg-white/70"><ImageIcon size={25}/></div>
            </div>
          )}
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
            {item.urgentAvailableNow ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-2.5 py-1.5 text-[10px] font-black text-white shadow-sm"><BoltIcon size={13}/>พร้อมยืมด่วน</span>
            ) : <span />}
            {item.distanceKm !== null && <span className="rounded-full bg-white/92 px-2.5 py-1.5 text-[10px] font-black text-[var(--ink)] shadow-sm backdrop-blur">{item.distanceKm.toFixed(1)} กม.</span>}
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-[11px] font-black uppercase tracking-[0.08em] text-[var(--gold-strong)]">{item.category}</p>
            <StatusPill>{conditionLabels[item.condition] ?? item.condition}</StatusPill>
          </div>
          <h3 className="mt-2 line-clamp-2 text-[17px] font-black leading-snug tracking-[-0.025em] text-[var(--ink)] sm:text-lg">{item.title}</h3>
          <p className="mt-2 flex min-w-0 items-center gap-1.5 text-xs text-[var(--muted)]"><MapPinIcon size={14} className="shrink-0"/><span className="truncate">{locationText(item)}</span></p>
          <div className="mt-2 flex min-w-0 items-center gap-1.5 text-xs text-[var(--muted-strong)]">
            <span className="truncate">{item.owner.displayName}</span>
            {item.owner.verified && <ShieldCheckIcon size={14} className="shrink-0 text-[var(--gold-strong)]"/>}
            {item.owner.ratingCount > 0 && <span className="ml-auto inline-flex shrink-0 items-center gap-1"><StarIcon size={13}/>{Number(item.owner.ratingAverage).toFixed(1)}</span>}
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-1 border-t border-[var(--line)] pt-4">
            {item.dailyRate && <p><span className="text-lg font-black">฿{money.format(Number(item.dailyRate))}</span><span className="ml-1 text-[11px] text-[var(--muted)]">/ วัน</span></p>}
            {!item.dailyRate && item.hourlyRate && <p><span className="text-lg font-black">฿{money.format(Number(item.hourlyRate))}</span><span className="ml-1 text-[11px] text-[var(--muted)]">/ ชม.</span></p>}
            {item.dailyRate && item.hourlyRate && <p className="text-[11px] text-[var(--muted)]">หรือ ฿{money.format(Number(item.hourlyRate))}/ชม.</p>}
          </div>
        </div>
      </Link>
    </article>
  );
}
