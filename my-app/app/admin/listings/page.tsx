import Link from "next/link";
import type { QueryResultRow } from "pg";
import { StatusPill } from "@/components/ui/primitives";
import { requireSuperadminPage } from "@/lib/auth/authorization";
import { query } from "@/lib/db";
import ListingModerationControl from "./listing-moderation-control";

type ListingRow = QueryResultRow & {
  id: string;
  title: string;
  category: string;
  status: "ACTIVE" | "PAUSED" | "UNAVAILABLE" | "ARCHIVED";
  hourly_rate: string | null;
  daily_rate: string | null;
  urgent_enabled: boolean;
  province: string;
  district: string | null;
  created_at: Date;
  owner_id: string;
  owner_name: string;
  owner_email: string;
  request_count: string;
  latest_action: string | null;
  latest_reason: string | null;
  latest_action_at: Date | null;
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ListingsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSuperadminPage("/admin/listings");
  const params = await searchParams;
  const q = one(params.q).trim().slice(0, 100);
  const allowedStatuses = ["ACTIVE", "PAUSED", "UNAVAILABLE", "ARCHIVED"];
  const status = allowedStatuses.includes(one(params.status).toUpperCase()) ? one(params.status).toUpperCase() : "ALL";
  const values: unknown[] = [];
  const where: string[] = [];
  if (q) {
    values.push(`%${q}%`);
    where.push(`(ri.title ILIKE $${values.length} OR ri.category ILIKE $${values.length} OR u.display_name ILIKE $${values.length} OR u.email ILIKE $${values.length})`);
  }
  if (status !== "ALL") {
    values.push(status);
    where.push(`ri.status::text = $${values.length}`);
  }

  const result = await query<ListingRow>(
    `SELECT
       ri.id, ri.title, ri.category, ri.status::text, ri.hourly_rate, ri.daily_rate,
       ri.urgent_enabled, ri.province, ri.district, ri.created_at,
       u.id AS owner_id, u.display_name AS owner_name, u.email AS owner_email,
       (SELECT count(*)::text FROM rental_requests rr WHERE rr.item_id = ri.id) AS request_count,
       audit.action AS latest_action,
       audit.details->>'reason' AS latest_reason,
       audit.created_at AS latest_action_at
     FROM rental_items ri
     JOIN users u ON u.id = ri.owner_id
     LEFT JOIN LATERAL (
       SELECT action, details, created_at
       FROM admin_audit_logs aal
       WHERE aal.target_type = 'RENTAL_ITEM' AND aal.target_id = ri.id
       ORDER BY aal.created_at DESC
       LIMIT 1
     ) audit ON true
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY ri.created_at DESC
     LIMIT 100`,
    values,
  );

  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <p className="bb-label">Superadmin / listings</p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-[-0.045em] sm:text-4xl">จัดการประกาศ</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">ดึงข้อมูลจาก rental_items จริง ซ่อนประกาศแบบ reversible โดยเก็บสถานะเดิมและเหตุผลทุกครั้งใน audit log</p>
          </div>
          <span className="w-fit rounded-full border border-[var(--line)] bg-white px-3 py-2 text-xs font-black">ผลลัพธ์ {result.rows.length}</span>
        </div>

        <form className="mt-6 grid gap-2 rounded-2xl border border-[var(--line)] bg-white p-3 sm:grid-cols-[1fr_auto_auto]" action="/admin/listings">
          <input name="q" defaultValue={q} placeholder="ค้นหาสินค้า หมวด เจ้าของ หรืออีเมล" className="bb-input min-h-11" />
          <select name="status" defaultValue={status} className="bb-input min-h-11 sm:w-44"><option value="ALL">ทุกสถานะ</option>{allowedStatuses.map((value) => <option key={value} value={value}>{value}</option>)}</select>
          <button className="min-h-11 rounded-xl bg-[var(--ink)] px-4 text-sm font-black text-white">ค้นหา</button>
        </form>

        <section className="mt-5 space-y-3">
          {result.rows.length === 0 ? (
            <div className="rounded-2xl border border-[var(--line)] bg-white p-10 text-center text-sm text-[var(--muted)]">ไม่พบประกาศตามเงื่อนไข</div>
          ) : result.rows.map((item) => (
            <article key={item.id} className="rounded-[22px] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-xs)] sm:p-5">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-black">{item.title}</h2>
                    <StatusPill tone={item.status === "ACTIVE" ? "success" : item.status === "PAUSED" ? "danger" : "neutral"}>{item.status}</StatusPill>
                    {item.urgent_enabled && <StatusPill tone="gold">URGENT</StatusPill>}
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted-strong)]">{item.category} · {item.district ? `${item.district}, ` : ""}{item.province}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">เจ้าของ: <b className="text-[var(--ink)]">{item.owner_name}</b> · {item.owner_email}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
                    {item.hourly_rate && <span className="rounded-xl bg-[var(--surface-2)] px-3 py-2">฿{Number(item.hourly_rate).toLocaleString("th-TH")}/ชม.</span>}
                    {item.daily_rate && <span className="rounded-xl bg-[var(--surface-2)] px-3 py-2">฿{Number(item.daily_rate).toLocaleString("th-TH")}/วัน</span>}
                    <span className="rounded-xl bg-[var(--surface-2)] px-3 py-2">{item.request_count} คำขอยืม</span>
                  </div>
                  {item.latest_action && <p className="mt-3 text-xs leading-5 text-[var(--muted)]">ล่าสุด: <b>{item.latest_action}</b>{item.latest_reason ? ` · ${item.latest_reason}` : ""}{item.latest_action_at ? ` · ${new Date(item.latest_action_at).toLocaleString("th-TH")}` : ""}</p>}
                  <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-[var(--muted)]"><span className="font-mono">{item.id}</span><Link href={`/rent/${item.id}`} className="font-black text-[var(--gold-strong)]">ดูหน้าสินค้า →</Link></div>
                </div>
                <div className="border-t border-[var(--line)] pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                  <ListingModerationControl itemId={item.id} status={item.status} adminHidden={item.status === "PAUSED" && item.latest_action === "LISTING_HIDDEN"} />
                </div>
              </div>
            </article>
          ))}
        </section>
        <p className="mt-5 text-xs text-[var(--muted)]"><Link href="/admin" className="font-black text-[var(--ink)]">← กลับหน้า Admin</Link> · จำกัดผลลัพธ์ 100 รายการต่อครั้งสำหรับ MVP</p>
      </div>
    </main>
  );
}
