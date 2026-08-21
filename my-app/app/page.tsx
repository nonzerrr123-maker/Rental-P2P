import Link from "next/link";
import RentalCard from "@/components/rental-card";
import SiteHeader from "@/components/site-header";
import {
  ArrowRightIcon,
  BoltIcon,
  CalendarIcon,
  CompassIcon,
  MapPinIcon,
  MessageIcon,
  PackageIcon,
  SearchIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { EmptyState, SectionHeading, SectionEyebrow, StatusPill } from "@/components/ui/primitives";
import {
  listMarketplaceFacets,
  parseMarketplaceFilters,
  searchPublicRentalItems,
  type MarketplaceFacets,
  type MarketplaceResult,
} from "@/lib/rental/marketplace";
import {
  parseCommunityRequestFilters,
  searchCommunityRequests,
  type CommunitySearchResult,
} from "@/lib/community/service";

export const dynamic = "force-dynamic";

const dateTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });
const money = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });

async function loadHomeData(): Promise<{
  marketplace: MarketplaceResult;
  facets: MarketplaceFacets;
  community: CommunitySearchResult;
}> {
  const marketplaceFilters = parseMarketplaceFilters(new URLSearchParams("limit=6"));
  const communityFilters = parseCommunityRequestFilters(new URLSearchParams("limit=3&sort=urgent"));
  const [marketplace, facets, community] = await Promise.allSettled([
    searchPublicRentalItems(marketplaceFilters),
    listMarketplaceFacets(),
    searchCommunityRequests(communityFilters),
  ]);

  return {
    marketplace: marketplace.status === "fulfilled" ? marketplace.value : { items: [], page: 1, limit: 6, total: 0, totalPages: 1 },
    facets: facets.status === "fulfilled" ? facets.value : { categories: [], provinces: [] },
    community: community.status === "fulfilled" ? community.value : { items: [], page: 1, limit: 3, total: 0, totalPages: 1 },
  };
}

function CommunityCard({ request }: { request: CommunitySearchResult["items"][number] }) {
  return (
    <Link href={`/community/${request.id}`} className="group block rounded-[22px] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-xs)] hover:-translate-y-0.5 hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <StatusPill tone={request.isUrgent ? "gold" : "neutral"}>{request.isUrgent ? "ต้องการด่วน" : request.category}</StatusPill>
        <span className="text-[11px] font-bold text-[var(--muted)]">{request.offerCount} ข้อเสนอ</span>
      </div>
      <h3 className="mt-4 line-clamp-2 text-lg font-black leading-snug tracking-[-0.025em]">{request.title}</h3>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--muted)]"><MapPinIcon size={14}/>{[request.subdistrict, request.district, request.province].filter(Boolean).join(" · ")}</p>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--muted)]"><CalendarIcon size={14}/>{dateTime.format(new Date(request.neededStartsAt))}</p>
      <div className="mt-5 flex items-end justify-between gap-3 border-t border-[var(--line)] pt-4">
        <p className="text-xs text-[var(--muted)]">โดย <span className="font-bold text-[var(--muted-strong)]">{request.requester.displayName}</span></p>
        {request.targetPrice && <p className="text-sm font-black">งบ ฿{money.format(Number(request.targetPrice))}</p>}
      </div>
    </Link>
  );
}

export default async function Home() {
  const { marketplace, facets, community } = await loadHomeData();
  const heroItem = marketplace.items[0] ?? null;

  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <SiteHeader />

      <section className="border-b border-[var(--line)]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:py-20">
          <div className="flex flex-col justify-center">
            <SectionEyebrow>Borow Borow · Peer-to-peer rental</SectionEyebrow>
            <h1 className="mt-4 max-w-3xl text-[clamp(3rem,7vw,5.8rem)] font-black leading-[.94] tracking-[-0.065em]">
              อยากใช้<br/><span className="ml-[200px] inline-block text-[var(--gold-strong)]">ไม่ต้องซื้อ</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[var(--muted-strong)] sm:text-lg sm:leading-8">
              ยืมของจากคนใกล้ตัวแบบมีตัวตนจริง เลือกช่วงเวลา จ่ายผ่านระบบ แชต นัดรับ และคืนของใน flow เดียว
            </p>

            <form action="/rent" method="get" className="mt-8 flex max-w-2xl items-center gap-2 rounded-2xl border border-[var(--line-strong)] bg-white p-2 shadow-[var(--shadow-soft)]">
              <SearchIcon className="ml-2 shrink-0 text-[var(--muted)]" size={21}/>
              <input name="q" aria-label="ค้นหาของให้ยืม" placeholder="วันนี้อยากยืมอะไร?" className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm font-semibold outline-none placeholder:text-[var(--muted)] sm:text-base"/>
              <button type="submit" className="shrink-0 rounded-xl bg-[var(--ink)] px-4 py-3 text-sm font-black text-white sm:px-5">ค้นหา</button>
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/location" className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3.5 py-2 text-xs font-black text-[var(--muted-strong)] hover:border-[var(--gold-line)]"><MapPinIcon size={15}/>ของใกล้ฉัน</Link>
              <Link href="/rent?urgent=true" className="inline-flex items-center gap-2 rounded-full border border-[var(--gold-line)] bg-[var(--gold-soft)] px-3.5 py-2 text-xs font-black text-[var(--gold-strong)]"><BoltIcon size={15}/>พร้อมยืมด่วน</Link>
              <Link href="/community" className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3.5 py-2 text-xs font-black text-[var(--muted-strong)] hover:border-[var(--gold-line)]"><UsersIcon size={15}/>โพสต์หาของ</Link>
            </div>

            <div className="mt-8 grid max-w-2xl gap-3 border-t border-[var(--line)] pt-6 sm:grid-cols-3">
              {[
                [ShieldCheckIcon, "ยืนยันตัวตน", "ก่อนยืมหรือปล่อยของ"],
                [MessageIcon, "คุยในระบบ", "มีบริบท Rental ชัดเจน"],
                [PackageIcon, "รับ–คืนเป็นขั้นตอน", "ติดตามสถานะได้"],
              ].map(([Icon, title, detail]) => {
                const Visual = Icon as typeof ShieldCheckIcon;
                return <div key={String(title)} className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--gold-strong)]"><Visual size={18}/></span><div><p className="text-xs font-black">{String(title)}</p><p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">{String(detail)}</p></div></div>;
              })}
            </div>
          </div>

          <div className="relative hidden min-h-[520px] lg:block">
            <div className="absolute inset-0 rounded-[36px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-soft)]"/>
            <div className="absolute left-7 right-7 top-7 flex items-center justify-between">
              <div><p className="bb-label">LIVE MARKETPLACE</p><p className="mt-1 text-sm font-bold text-[var(--muted)]">รายการจริงล่าสุดในระบบ</p></div>
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--gold-soft)] text-[var(--gold-strong)]"><CompassIcon/></span>
            </div>
            <div className="absolute inset-x-7 bottom-7 top-24">
              {heroItem ? <RentalCard item={heroItem} priority /> : (
                <div className="grid h-full place-items-center rounded-[28px] border border-dashed border-[var(--line-strong)] bg-white/60 p-10 text-center">
                  <div><PackageIcon className="mx-auto text-[var(--muted)]" size={34}/><p className="mt-4 font-black">ยังไม่มีของให้ยืม</p><p className="mt-2 text-sm text-[var(--muted)]">เมื่อมีรายการจริง การ์ดล่าสุดจะขึ้นตรงนี้โดยอัตโนมัติ</p></div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {facets.categories.length > 0 && (
        <section className="border-b border-[var(--line)] bg-[var(--surface)]">
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
            <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
              <span className="mr-2 self-center whitespace-nowrap text-xs font-black text-[var(--muted)]">หมวดหมู่</span>
              {facets.categories.slice(0, 10).map((category) => (
                <Link key={category} href={`/rent?category=${encodeURIComponent(category)}`} className="whitespace-nowrap rounded-full border border-[var(--line)] bg-white px-4 py-2 text-xs font-extrabold text-[var(--muted-strong)] hover:border-[var(--gold-line)] hover:text-[var(--ink)]">{category}</Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <SectionHeading eyebrow="Discover" title="ของให้ยืมล่าสุด" description="รายการจริงจากผู้ให้ยืมในระบบ ไม่มีการ์ดตัวอย่างหรือยอดปลอม" actionHref="/rent" actionLabel="ดูทั้งหมด"/>
        {marketplace.items.length > 0 ? (
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{marketplace.items.map((item) => <RentalCard key={item.id} item={item}/>)}</div>
        ) : <div className="mt-7"><EmptyState title="ยังไม่มีของให้ยืม" description="เป็นคนแรกที่ลงของใน Borow Borow หรือกลับมาดูใหม่เมื่อมีรายการเพิ่ม" actionHref="/lend" actionLabel="ลงของให้ยืม"/></div>}
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
        <div className="grid overflow-hidden rounded-[28px] bg-[var(--ink)] text-white lg:grid-cols-[1fr_auto]">
          <div className="p-6 sm:p-8 lg:p-10">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-[var(--gold)]"><BoltIcon/></span>
            <h2 className="mt-5 text-2xl font-black tracking-[-0.035em] sm:text-3xl">ต้องใช้วันนี้? ดูของที่พร้อมยืมด่วน</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">กรองเฉพาะรายการที่เจ้าของเปิดสถานะพร้อม และระบบเช็กช่วงเวลาว่างก่อนสร้างคำขอ</p>
            <Link href="/rent?urgent=true" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--gold)] px-5 py-3 text-sm font-black text-[var(--ink)]">ดูยืมด่วน<ArrowRightIcon size={16}/></Link>
          </div>
          <div className="hidden w-64 place-items-center border-l border-white/10 lg:grid"><BoltIcon size={90} className="text-white/10"/></div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <SectionHeading eyebrow="Community" title="หาไม่เจอ ให้คอมมูช่วยหา" description="โพสต์ของที่ต้องการ ช่วงเวลา และงบ แล้วให้คนที่มีของส่งข้อเสนอเข้ามา" actionHref="/community" actionLabel="เปิดคอมมู"/>
        {community.items.length > 0 ? (
          <div className="mt-7 grid gap-4 md:grid-cols-3">{community.items.map((request) => <CommunityCard key={request.id} request={request}/>)}</div>
        ) : <div className="mt-7"><EmptyState title="ยังไม่มีโพสต์หาของ" description="ถ้าค้นหาใน Marketplace แล้วไม่เจอ คุณสามารถโพสต์สิ่งที่ต้องการให้คนใกล้ตัวเสนอของได้" actionHref="/community/new" actionLabel="โพสต์หาของ"/></div>}
      </section>

      <section className="border-y border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <SectionHeading eyebrow="How it works" title="ยืมของแบบไม่ต้องเดาว่าต้องทำอะไรต่อ" description="ทุกขั้นถูกผูกกับ Rental เดียว ตั้งแต่คำขอจนจบรีวิว"/>
          <div className="mt-8 grid gap-3 md:grid-cols-4">
            {[
              [SearchIcon, "ค้นหา", "เลือกของ ราคา และพื้นที่ที่เหมาะกับคุณ"],
              [CalendarIcon, "จองเวลา", "เลือกรายชั่วโมงหรือรายวันตามที่เจ้าของเปิดไว้"],
              [MessageIcon, "จ่ายและคุย", "Checkout แล้วคุยรายละเอียดนัดรับในแชต"],
              [ShieldCheckIcon, "รับ–คืน", "ยืนยันรับของ คืนของ และรีวิวเมื่อจบ"],
            ].map(([Icon, title, detail], index) => {
              const Visual = Icon as typeof SearchIcon;
              return <div key={String(title)} className="rounded-[22px] border border-[var(--line)] bg-white p-5"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--gold-strong)]"><Visual size={19}/></span><span className="text-xs font-black text-[var(--muted)]">0{index + 1}</span></div><h3 className="mt-5 font-black">{String(title)}</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{String(detail)}</p></div>;
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-6 rounded-[28px] border border-[var(--gold-line)] bg-[var(--gold-soft)] p-6 sm:p-8 lg:flex-row lg:items-center">
          <div><p className="bb-label">LEND WITH CONFIDENCE</p><h2 className="mt-2 text-2xl font-black tracking-[-0.035em]">มีของว่างอยู่? ให้มันสร้างมูลค่าแทนการนอนเก็บ</h2><p className="mt-2 text-sm text-[var(--muted-strong)]">ตั้งราคา เงินประกัน ช่วงเวลาว่าง และเปิด–ปิดยืมด่วนได้เอง</p></div>
          <Link href="/lend" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3 text-sm font-black text-white">ลงของให้ยืม<ArrowRightIcon size={16}/></Link>
        </div>
      </section>

      <footer className="border-t border-[var(--line)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div><p className="font-black text-[var(--ink)]">Borow Borow</p><p className="mt-1">ยืมสิ่งที่ต้องใช้ จากคนที่อยู่ใกล้กว่า</p></div>
          <div className="flex flex-wrap gap-5"><Link href="/rent">ค้นหาของ</Link><Link href="/community">คอมมูหาของ</Link><Link href="/verification">การยืนยันตัวตน</Link></div>
        </div>
      </footer>
    </main>
  );
}
