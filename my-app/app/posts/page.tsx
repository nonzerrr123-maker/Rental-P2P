import SiteHeader from "@/components/site-header";
import { requireUserPage } from "@/lib/auth/authorization";
import { listRentalListingsForOwner } from "@/lib/rental/listings";
import {
  parseCommunityRequestFilters,
  searchCommunityRequests,
} from "@/lib/community/service";
import PostManagement from "./post-management";

export const dynamic = "force-dynamic";

export default async function MyPostsPage() {
  const user = await requireUserPage("/posts");
  const communityFilters = parseCommunityRequestFilters(
    new URLSearchParams("status=ALL&limit=48"),
    { requesterId: user.id, defaultStatus: "ALL" },
  );
  const [rentals, community] = await Promise.all([
    listRentalListingsForOwner(user.id),
    searchCommunityRequests(communityFilters),
  ]);

  return <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
    <SiteHeader/>
    <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-[var(--line)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="bb-label">My posts</p><h1 className="mt-2 text-3xl font-black tracking-[-0.045em] sm:text-4xl">โพสต์ของฉัน</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">จัดการของให้ยืมและโพสต์หาของจากที่เดียว การเปลี่ยนสถานะมีผลกับการค้นหาและคำขอใหม่เท่านั้น ไม่ย้อนแก้ธุรกรรมเดิม</p></div>
        <p className="text-xs font-bold text-[var(--muted)]">{rentals.length + community.items.length} โพสต์ทั้งหมด</p>
      </div>
      <div className="mt-6"><PostManagement initialRentals={rentals} initialCommunity={community.items}/></div>
    </div>
  </main>;
}
