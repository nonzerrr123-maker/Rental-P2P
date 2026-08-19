import Link from "next/link";
import RentalCard from "@/components/rental-card";
import SiteHeader from "@/components/site-header";
import { MapPinIcon, SearchIcon } from "@/components/ui/icons";
import { EmptyState, SectionEyebrow } from "@/components/ui/primitives";
import {
  listMarketplaceFacets,
  MarketplaceValidationError,
  parseMarketplaceFilters,
  searchPublicRentalItems,
  type MarketplaceFilters as MarketplaceFilterState,
} from "@/lib/rental/marketplace";
import { MarketplaceFilters } from "./marketplace-filters";

const money = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });

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
  const locationSearchActive = filters.latitude !== null && filters.longitude !== null && filters.radiusKm !== null;

  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <SiteHeader />

      <section className="border-b border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6 sm:py-12 lg:px-8">
          <SectionEyebrow>Rental marketplace</SectionEyebrow>
          <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-3xl font-black tracking-[-0.045em] sm:text-4xl lg:text-5xl">ของที่อยากใช้ อาจอยู่ใกล้กว่าที่คิด</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">ค้นหาแบบง่ายก่อน แล้วค่อยเปิดตัวกรองเพิ่มเติมเมื่ออยากเจาะจงราคา สภาพ ยืมด่วน หรือตำแหน่งใกล้ตัว</p>
            </div>
            {filters.radiusKm !== null && (
              <div className="inline-flex self-start items-center gap-2 rounded-full border border-[var(--gold-line)] bg-[var(--gold-soft)] px-3.5 py-2 text-xs font-black text-[var(--gold-strong)]">
                <MapPinIcon size={15}/>อ่านตำแหน่งแล้ว · {filters.radiusKm} กม.
              </div>
            )}
          </div>

          <div className="mt-7"><MarketplaceFilters initial={filterValues(filters)} categories={facets.categories} provinces={facets.provinces} /></div>
          {validationMessage && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{validationMessage} — แสดงผลด้วยตัวกรองเริ่มต้นแทน</p>}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div><h2 className="text-xl font-black tracking-[-0.025em] sm:text-2xl">ของให้ยืม</h2><p className="mt-1 text-xs text-[var(--muted)] sm:text-sm">พบ {money.format(result.total)} รายการ{locationSearchActive ? ` ภายใน ${filters.radiusKm} กม.` : ""}</p></div>
          <Link href="/community/new" className="hidden text-sm font-black text-[var(--gold-strong)] sm:inline">หาไม่เจอ? โพสต์หา</Link>
        </div>

        {result.items.length > 0 ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{result.items.map((item) => <RentalCard key={item.id} item={item}/>)}</div>
        ) : locationSearchActive ? (
          <div className="mt-6"><EmptyState title={`อ่านตำแหน่งสำเร็จ แต่ยังไม่มีของใน ${filters.radiusKm} กม.`} description="GPS ทำงานแล้วและระบบค้นจากตำแหน่งปัจจุบันเรียบร้อย ลองเพิ่มระยะเป็น 50 กม. หรือเลือกจังหวัดเพื่อดูของที่ยังไม่ได้ตั้งพิกัด Nearby" actionHref="/rent" actionLabel="ค้นหาทุกพื้นที่"/></div>
        ) : (
          <div className="mt-6"><EmptyState title="ยังไม่เจอของที่ตรงกับตัวกรอง" description="ลองเปลี่ยนคำค้น หมวดหมู่ จังหวัด หรือล้างตัวกรอง แล้วถ้ายังไม่เจอสามารถโพสต์ให้คอมมูช่วยหาได้" actionHref="/community/new" actionLabel="โพสต์หาของ"/></div>
        )}

        {result.totalPages > 1 && (
          <nav className="mt-10 flex items-center justify-center gap-3" aria-label="Pagination">
            {result.page > 1 ? <Link href={pageHref(urlParams, result.page - 1)} className="rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-black">ก่อนหน้า</Link> : <span/>}
            <span className="text-xs font-bold text-[var(--muted)]">หน้า {result.page} / {result.totalPages}</span>
            {result.page < result.totalPages && <Link href={pageHref(urlParams, result.page + 1)} className="rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-sm font-black">ถัดไป</Link>}
          </nav>
        )}

        {result.items.length === 0 && <div className="sr-only"><SearchIcon/>ไม่มีผลลัพธ์</div>}
      </section>
    </main>
  );
}
