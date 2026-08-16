import Image from "next/image";
import Link from "next/link";
import {
  listMarketplaceFacets,
  MarketplaceValidationError,
  parseMarketplaceFilters,
  searchPublicRentalItems,
  type MarketplaceFilters as MarketplaceFilterState,
} from "@/lib/rental/marketplace";
import { MarketplaceFilters } from "./marketplace-filters";

const money = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });

const conditionLabels: Record<string, string> = {
  NEW: "ใหม่",
  LIKE_NEW: "เหมือนใหม่",
  GOOD: "สภาพดี",
  FAIR: "พอใช้",
  USED: "มีร่องรอยใช้งาน",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function toUrlSearchParams(input: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) value.forEach((entry) => params.append(key, entry));
    else if (value !== undefined) params.set(key, value);
  }
  return params;
}

function pageHref(params: URLSearchParams, page: number) {
  const next = new URLSearchParams(params);
  if (page <= 1) next.delete("page");
  else next.set("page", String(page));
  const query = next.toString();
  return query ? `/rent?${query}` : "/rent";
}

function locationText(item: { province: string; district: string | null; subdistrict: string | null }) {
  return [item.subdistrict, item.district, item.province].filter(Boolean).join(" · ");
}

function filterValues(filters: MarketplaceFilterState) {
  return {
    q: filters.q,
    category: filters.category,
    province: filters.province,
    district: filters.district,
    subdistrict: filters.subdistrict,
    condition: filters.condition ?? "",
    pricingMode: filters.pricingMode ?? "",
    urgent: filters.urgent,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    latitude: filters.latitude,
    longitude: filters.longitude,
    radiusKm: filters.radiusKm,
    sort: filters.sort,
  };
}

export default async function RentPage({ searchParams }: { searchParams: SearchParams }) {
  const resolvedSearchParams = await searchParams;
  const urlParams = toUrlSearchParams(resolvedSearchParams);
  let validationMessage = "";
  let filters: MarketplaceFilterState;

  try {
    filters = parseMarketplaceFilters(urlParams);
  } catch (error) {
    if (!(error instanceof MarketplaceValidationError)) throw error;
    validationMessage = Object.values(error.fieldErrors)[0] ?? "ตัวกรองไม่ถูกต้อง";
    filters = parseMarketplaceFilters(new URLSearchParams());
  }

  const [result, facets] = await Promise.all([
    searchPublicRentalItems(filters),
    listMarketplaceFacets(),
  ]);

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-neutral-950">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-2xl font-black">Borow Borow<span className="text-[#c9a227]">.</span></Link>
          <div className="flex items-center gap-2">
            <Link href="/location" className="rounded-full border border-[#d8c16d] px-4 py-2 text-sm font-bold text-[#806515]">📍 Nearby</Link>
            <Link href="/lend" className="rounded-full border px-4 py-2 text-sm font-bold hover:border-[#c9a227]">ลงของให้ยืม</Link>
            <Link href="/dashboard" className="rounded-full bg-neutral-950 px-4 py-2 text-sm font-bold text-white">Dashboard</Link>
          </div>
        </div>
      </header>

      <section className="border-b border-neutral-200 bg-white px-6 py-12 md:py-16">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-black tracking-[0.28em] text-[#9d7d13]">RENTAL MARKETPLACE</p>
          <div className="mt-3 max-w-3xl">
            <h1 className="text-4xl font-black tracking-tight md:text-5xl">ของที่อยากใช้ อาจอยู่ใกล้กว่าที่คิด</h1>
            <p className="mt-4 text-neutral-500">ค้นหาของจากรายการจริง เลือกพื้นที่ ราคา ยืมด่วน หรือใช้ตำแหน่งปัจจุบันเพื่อเรียงของที่อยู่ใกล้คุณ</p>
          </div>

          <div className="mt-8">
            <MarketplaceFilters initial={filterValues(filters)} categories={facets.categories} provinces={facets.provinces} />
          </div>
          {validationMessage && (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {validationMessage} — แสดงผลด้วยตัวกรองเริ่มต้นแทน
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-black">ของให้ยืม</h2>
            <p className="mt-1 text-sm text-neutral-500">พบ {money.format(result.total)} รายการ</p>
          </div>
          {filters.radiusKm !== null && (
            <div className="rounded-full bg-[#faf5df] px-4 py-2 text-sm font-bold text-[#856a10]">
              📍 ภายใน {filters.radiusKm} กม. · เรียงจากใกล้ที่สุด
            </div>
          )}
        </div>

        {result.items.length > 0 ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {result.items.map((item) => (
              <article key={item.id} className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <Link href={`/rent/${item.id}`} className="block">
                  <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100">
                    {item.coverImageUrl ? (
                      <Image
                        src={item.coverImageUrl}
                        alt={item.title}
                        fill
                        unoptimized
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-5xl text-neutral-300">📦</div>
                    )}
                    {item.urgentAvailableNow && (
                      <span className="absolute left-3 top-3 rounded-full bg-neutral-950 px-3 py-1.5 text-xs font-black text-white">⚡ ยืมด่วน · ว่างตอนนี้</span>
                    )}
                    {item.distanceKm !== null && (
                      <span className="absolute bottom-3 right-3 rounded-full bg-white/95 px-3 py-1.5 text-xs font-black shadow-sm">{item.distanceKm.toFixed(1)} กม.</span>
                    )}
                  </div>

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-xs font-black text-[#9d7d13]">{item.category}</span>
                      <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-bold text-neutral-600">{conditionLabels[item.condition]}</span>
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-lg font-black">{item.title}</h3>
                    <p className="mt-2 truncate text-xs text-neutral-500">📍 {locationText(item)}</p>
                    <p className="mt-2 text-sm text-neutral-600">
                      {item.owner.displayName} {item.owner.verified && <span title="ยืนยันตัวตนแล้ว">✓</span>}
                      {item.owner.ratingCount > 0 && <span> · ⭐ {Number(item.owner.ratingAverage).toFixed(1)}</span>}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t pt-4">
                      {item.hourlyRate && <p><b>฿{money.format(Number(item.hourlyRate))}</b><span className="text-xs text-neutral-500"> / ชม.</span></p>}
                      {item.dailyRate && <p><b>฿{money.format(Number(item.dailyRate))}</b><span className="text-xs text-neutral-500"> / วัน</span></p>}
                    </div>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-dashed border-neutral-300 bg-white p-12 text-center">
            <div className="text-5xl">🔎</div>
            <h3 className="mt-4 text-xl font-black">ยังไม่เจอของที่ตรงกับตัวกรอง</h3>
            <p className="mt-2 text-sm text-neutral-500">ลองขยายระยะทาง เปลี่ยนจังหวัด หรือล้างตัวกรองแล้วค้นหาใหม่</p>
            <Link href="/rent" className="mt-5 inline-block rounded-xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white">ล้างตัวกรอง</Link>
          </div>
        )}

        {result.totalPages > 1 && (
          <nav className="mt-10 flex items-center justify-center gap-3" aria-label="Pagination">
            {result.page > 1 ? (
              <Link href={pageHref(urlParams, result.page - 1)} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">← ก่อนหน้า</Link>
            ) : <span />}
            <span className="text-sm font-semibold text-neutral-500">หน้า {result.page} / {result.totalPages}</span>
            {result.page < result.totalPages && (
              <Link href={pageHref(urlParams, result.page + 1)} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">ถัดไป →</Link>
            )}
          </nav>
        )}
      </section>
    </main>
  );
}
