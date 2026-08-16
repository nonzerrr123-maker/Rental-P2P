import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import {
  listCommunityFacets,
  parseCommunityRequestFilters,
  searchCommunityRequests,
  CommunityError,
  type CommunityRequestFilters as FilterState,
} from "@/lib/community/service";
import CommunityFilters from "./community-filters";

const money = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

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
  return `/community${next.toString() ? `?${next.toString()}` : ""}`;
}

function filterValues(filters: FilterState, mine: boolean) {
  return {
    q: filters.q,
    category: filters.category,
    province: filters.province,
    district: filters.district,
    subdistrict: filters.subdistrict,
    urgent: filters.urgent,
    sort: filters.sort,
    status: filters.status,
    mine,
    latitude: filters.latitude,
    longitude: filters.longitude,
    radiusKm: filters.radiusKm,
  };
}

const statusLabels: Record<string, string> = {
  OPEN: "เปิดรับข้อเสนอ",
  MATCHED: "จับคู่แล้ว",
  CLOSED: "ปิดแล้ว",
  CANCELLED: "ยกเลิก",
  EXPIRED: "หมดอายุ",
};

export default async function CommunityPage({ searchParams }: { searchParams: SearchParams }) {
  const resolved = await searchParams;
  const params = toUrlSearchParams(resolved);
  const user = await getCurrentUser();
  const mine = ["1", "true"].includes((params.get("mine") ?? "").toLowerCase());
  let validationMessage = "";
  let filters: FilterState;
  try {
    filters = parseCommunityRequestFilters(params, {
      requesterId: mine && user ? user.id : null,
      defaultStatus: mine ? "ALL" : "OPEN",
    });
  } catch (error) {
    if (!(error instanceof CommunityError)) throw error;
    validationMessage = Object.values(error.fieldErrors)[0] ?? "ตัวกรองไม่ถูกต้อง";
    filters = parseCommunityRequestFilters(new URLSearchParams(), {
      requesterId: mine && user ? user.id : null,
      defaultStatus: mine ? "ALL" : "OPEN",
    });
  }

  const [result, facets] = await Promise.all([searchCommunityRequests(filters), listCommunityFacets()]);

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-neutral-950">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 md:px-6">
          <Link href="/" className="text-2xl font-black">Borow Borow<span className="text-[#c9a227]">.</span></Link>
          <div className="flex items-center gap-2">
            <Link href="/rent" className="rounded-full border px-4 py-2 text-sm font-bold">ของให้ยืม</Link>
            <Link href="/community/new" className="rounded-full bg-neutral-950 px-4 py-2 text-sm font-black text-white">+ โพสต์หาของ</Link>
          </div>
        </div>
      </header>

      <section className="border-b border-neutral-200 bg-white px-5 py-12 md:px-6 md:py-16">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-black tracking-[0.28em] text-[#9d7d13]">COMMUNITY REQUESTS</p>
          <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-black tracking-tight md:text-5xl">คอมมูหาของ — ไม่มีประกาศ ก็โพสต์หาได้</h1>
              <p className="mt-4 leading-7 text-neutral-500">บอกว่าต้องการอะไร เมื่อไหร่ งบเท่าไร แล้วให้คนใกล้ตัวเสนอของจริงเข้ามา ก่อนจับคู่เข้าสู่ระบบเช่าและชำระเงินปกติ</p>
            </div>
            <div className="flex gap-2">
              <Link href="/community" className={`rounded-full px-4 py-2 text-sm font-bold ${!mine ? "bg-[#faf5df] text-[#84680c]" : "border"}`}>คำขอทั้งหมด</Link>
              <Link href={user ? "/community?mine=1" : "/login?next=%2Fcommunity%3Fmine%3D1"} className={`rounded-full px-4 py-2 text-sm font-bold ${mine ? "bg-[#faf5df] text-[#84680c]" : "border"}`}>คำขอของฉัน</Link>
            </div>
          </div>
          <div className="mt-8"><CommunityFilters initial={filterValues(filters, mine)} categories={facets.categories} provinces={facets.provinces} /></div>
          {validationMessage && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{validationMessage}</p>}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10 md:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-black">{mine ? "คำขอของฉัน" : "คนกำลังหาอะไรอยู่"}</h2>
            <p className="mt-1 text-sm text-neutral-500">พบ {money.format(result.total)} คำขอ</p>
          </div>
          {filters.radiusKm !== null && <span className="rounded-full bg-[#faf5df] px-4 py-2 text-sm font-bold text-[#856a10]">📍 ภายใน {filters.radiusKm} กม.</span>}
        </div>

        {result.items.length ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {result.items.map((item) => (
              <article key={item.id} className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  {item.isUrgent && <span className="rounded-full bg-neutral-950 px-3 py-1 text-xs font-black text-white">⚡ ต้องการด่วน</span>}
                  <span className="rounded-full bg-[#faf5df] px-3 py-1 text-xs font-black text-[#84680c]">{item.category}</span>
                  {mine && <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold">{statusLabels[item.status] ?? item.status}</span>}
                  {item.distanceKm !== null && <span className="ml-auto text-xs font-black">{item.distanceKm.toFixed(1)} กม.</span>}
                </div>
                <Link href={`/community/${item.id}`} className="block">
                  <h3 className="mt-4 text-xl font-black leading-snug">{item.title}</h3>
                  {item.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-500">{item.description}</p>}
                  <div className="mt-5 grid gap-2 rounded-2xl bg-neutral-50 p-4 text-sm">
                    <p><span className="text-neutral-500">ต้องการช่วง</span> <b>{dateTime.format(new Date(item.neededStartsAt))}</b></p>
                    <p><span className="text-neutral-500">ถึง</span> <b>{dateTime.format(new Date(item.neededEndsAt))}</b></p>
                    <p><span className="text-neutral-500">พื้นที่</span> <b>{[item.subdistrict, item.district, item.province].filter(Boolean).join(" · ")}</b></p>
                    {item.targetPrice && <p><span className="text-neutral-500">งบเป้าหมาย</span> <b>฿{money.format(Number(item.targetPrice))}</b></p>}
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                    <span className="text-neutral-500">{item.requester.displayName} {item.requester.verified ? "✓" : ""}</span>
                    <span className="font-black">{item.offerCount} ข้อเสนอ →</span>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-dashed bg-white p-12 text-center">
            <div className="text-5xl">🧭</div>
            <h3 className="mt-4 text-xl font-black">ยังไม่มีคำขอที่ตรงกับตัวกรอง</h3>
            <p className="mt-2 text-sm text-neutral-500">ลองขยายพื้นที่ ล้างตัวกรอง หรือโพสต์สิ่งที่คุณกำลังหาเอง</p>
            <Link href="/community/new" className="mt-5 inline-block rounded-xl bg-neutral-950 px-5 py-3 text-sm font-black text-white">โพสต์หาของ</Link>
          </div>
        )}

        {result.totalPages > 1 && (
          <nav className="mt-10 flex items-center justify-center gap-3">
            {result.page > 1 ? <Link href={pageHref(params, result.page - 1)} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">← ก่อนหน้า</Link> : <span />}
            <span className="text-sm font-semibold text-neutral-500">หน้า {result.page} / {result.totalPages}</span>
            {result.page < result.totalPages && <Link href={pageHref(params, result.page + 1)} className="rounded-xl border bg-white px-4 py-2 text-sm font-bold">ถัดไป →</Link>}
          </nav>
        )}
      </section>
    </main>
  );
}
