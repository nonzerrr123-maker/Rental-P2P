import Link from "next/link";
import type { QueryResultRow } from "pg";
import { StatusPill } from "@/components/ui/primitives";
import { requireSuperadminPage } from "@/lib/auth/authorization";
import { query } from "@/lib/db";
import UserModerationControl from "./user-moderation-control";

type UserRow = QueryResultRow & {
  id: string;
  display_name: string;
  email: string;
  phone: string | null;
  role: "USER" | "ADMIN" | "SUPERADMIN";
  verification_status: string;
  is_active: boolean;
  created_at: Date;
  active_listings: string;
  borrowed_count: string;
  lent_count: string;
  latest_action: string | null;
  latest_reason: string | null;
  latest_action_at: Date | null;
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requireSuperadminPage("/admin/users");
  const params = await searchParams;
  const q = one(params.q).trim().slice(0, 100);
  const status = ["active", "banned"].includes(one(params.status)) ? one(params.status) : "all";
  const values: unknown[] = [];
  const where: string[] = [];
  if (q) {
    values.push(`%${q}%`);
    where.push(`(u.display_name ILIKE $${values.length} OR u.email ILIKE $${values.length})`);
  }
  if (status === "active") where.push("u.is_active = true");
  if (status === "banned") where.push("u.is_active = false");

  const result = await query<UserRow>(
    `SELECT
       u.id, u.display_name, u.email, u.phone, u.role::text, u.verification_status::text,
       u.is_active, u.created_at,
       (SELECT count(*)::text FROM rental_items ri WHERE ri.owner_id = u.id AND ri.status = 'ACTIVE') AS active_listings,
       (SELECT count(*)::text FROM rental_requests rr WHERE rr.borrower_id = u.id) AS borrowed_count,
       (SELECT count(*)::text FROM rental_requests rr WHERE rr.lender_id = u.id) AS lent_count,
       audit.action AS latest_action,
       audit.details->>'reason' AS latest_reason,
       audit.created_at AS latest_action_at
     FROM users u
     LEFT JOIN LATERAL (
       SELECT action, details, created_at
       FROM admin_audit_logs aal
       WHERE aal.target_type = 'USER' AND aal.target_id = u.id
       ORDER BY aal.created_at DESC
       LIMIT 1
     ) audit ON true
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY u.created_at DESC
     LIMIT 100`,
    values,
  );

  const total = result.rows.length;
  const banned = result.rows.filter((user) => !user.is_active).length;

  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <p className="bb-label">Superadmin / users</p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-[-0.045em] sm:text-4xl">จัดการผู้ใช้งาน</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">อ่านข้อมูลบัญชีจาก PostgreSQL จริง แบนบัญชีแบบ reversible และ revoke session ทันทีโดยไม่ลบประวัติธุรกรรม</p>
          </div>
          <div className="flex gap-2 text-xs font-black"><span className="rounded-full border border-[var(--line)] bg-white px-3 py-2">ผลลัพธ์ {total}</span><span className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-red-700">ถูกแบน {banned}</span></div>
        </div>

        <form className="mt-6 grid gap-2 rounded-2xl border border-[var(--line)] bg-white p-3 sm:grid-cols-[1fr_auto_auto]" action="/admin/users">
          <input name="q" defaultValue={q} placeholder="ค้นหาชื่อหรืออีเมล" className="bb-input min-h-11" />
          <select name="status" defaultValue={status} className="bb-input min-h-11 sm:w-40"><option value="all">ทุกสถานะ</option><option value="active">ใช้งานได้</option><option value="banned">ถูกแบน</option></select>
          <button className="min-h-11 rounded-xl bg-[var(--ink)] px-4 text-sm font-black text-white">ค้นหา</button>
        </form>

        <section className="mt-5 space-y-3">
          {result.rows.length === 0 ? (
            <div className="rounded-2xl border border-[var(--line)] bg-white p-10 text-center text-sm text-[var(--muted)]">ไม่พบผู้ใช้ตามเงื่อนไข</div>
          ) : result.rows.map((user) => (
            <article key={user.id} className="rounded-[22px] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-xs)] sm:p-5">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-black">{user.display_name}</h2>
                    <StatusPill tone={user.is_active ? "success" : "danger"}>{user.is_active ? "ACTIVE" : "BANNED"}</StatusPill>
                    <StatusPill tone={user.verification_status === "VERIFIED" ? "gold" : "neutral"}>{user.verification_status}</StatusPill>
                    <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[10px] font-black">{user.role}</span>
                  </div>
                  <p className="mt-2 break-all text-sm text-[var(--muted-strong)]">{user.email}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{user.phone ?? "ยังไม่มีเบอร์โทร"} · สมัคร {new Date(user.created_at).toLocaleDateString("th-TH")}</p>
                  <div className="mt-4 grid grid-cols-3 gap-2 sm:max-w-lg">
                    <div className="rounded-xl bg-[var(--surface-2)] p-3"><b>{user.active_listings}</b><p className="text-[10px] text-[var(--muted)]">ประกาศ Active</p></div>
                    <div className="rounded-xl bg-[var(--surface-2)] p-3"><b>{user.borrowed_count}</b><p className="text-[10px] text-[var(--muted)]">เคยยืม</p></div>
                    <div className="rounded-xl bg-[var(--surface-2)] p-3"><b>{user.lent_count}</b><p className="text-[10px] text-[var(--muted)]">เคยให้ยืม</p></div>
                  </div>
                  {user.latest_action && <p className="mt-3 text-xs leading-5 text-[var(--muted)]">ล่าสุด: <b>{user.latest_action}</b>{user.latest_reason ? ` · ${user.latest_reason}` : ""}{user.latest_action_at ? ` · ${new Date(user.latest_action_at).toLocaleString("th-TH")}` : ""}</p>}
                  <p className="mt-2 font-mono text-[10px] text-[var(--muted)]">{user.id}</p>
                </div>
                <div className="border-t border-[var(--line)] pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                  {user.id === actor.id ? <p className="text-xs font-bold text-[var(--muted)]">บัญชีที่กำลังใช้งานอยู่ ไม่สามารถแบนตัวเองได้</p> : <UserModerationControl userId={user.id} isActive={user.is_active} protectedAccount={user.role === "SUPERADMIN"} />}
                </div>
              </div>
            </article>
          ))}
        </section>
        <p className="mt-5 text-xs text-[var(--muted)]"><Link href="/admin" className="font-black text-[var(--ink)]">← กลับหน้า Admin</Link> · จำกัดผลลัพธ์ 100 บัญชีต่อครั้งสำหรับ MVP</p>
      </div>
    </main>
  );
}
