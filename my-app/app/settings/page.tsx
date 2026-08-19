import Link from "next/link";
import type { QueryResultRow } from "pg";
import SiteHeader from "@/components/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionEyebrow, StatusPill } from "@/components/ui/primitives";
import { requireUserPage } from "@/lib/auth/authorization";
import { query } from "@/lib/db";

type SettingsSummaryRow = QueryResultRow & {
  email_verified: boolean;
  active_sessions: string;
  unread_notifications: string;
};

export default async function SettingsPage() {
  const user = await requireUserPage("/settings");
  const summaryResult = await query<SettingsSummaryRow>(
    `SELECT
       EXISTS(SELECT 1 FROM user_email_verifications WHERE user_id=$1) AS email_verified,
       (SELECT count(*)::text FROM user_sessions WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>now()) AS active_sessions,
       (SELECT count(*)::text FROM notifications WHERE user_id=$1 AND read_at IS NULL) AS unread_notifications`,
    [user.id],
  );
  const summary = summaryResult.rows[0];

  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <SiteHeader />
      <div className="bb-container py-8 sm:py-12">
        <SectionEyebrow>Settings</SectionEyebrow>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-[-0.045em] sm:text-4xl">ตั้งค่าบัญชี</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">จัดการโปรไฟล์ ความปลอดภัย การยืนยันตัวตน และสถานะบัญชีจากจุดเดียว</p>
          </div>
          <StatusPill tone={user.verificationStatus === "VERIFIED" ? "gold" : "neutral"}>{user.verificationStatus}</StatusPill>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--line)] bg-white p-4"><p className="text-xs font-bold text-[var(--muted)]">Email</p><p className="mt-1 text-sm font-black">{summary?.email_verified ? "ยืนยันแล้ว" : "ยังไม่ยืนยัน"}</p></div>
          <div className="rounded-2xl border border-[var(--line)] bg-white p-4"><p className="text-xs font-bold text-[var(--muted)]">Active sessions</p><p className="mt-1 text-sm font-black">{summary?.active_sessions ?? "0"} อุปกรณ์/เซสชัน</p></div>
          <div className="rounded-2xl border border-[var(--line)] bg-white p-4"><p className="text-xs font-bold text-[var(--muted)]">Notifications</p><p className="mt-1 text-sm font-black">{summary?.unread_notifications ?? "0"} ยังไม่ได้อ่าน</p></div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Link href="/settings/profile" className="block">
            <Card className="h-full hover:border-[var(--gold-line)]">
              <CardHeader><CardTitle>โปรไฟล์</CardTitle><CardDescription>รูปโปรไฟล์ ชื่อที่แสดง แนะนำตัว และเบอร์โทรภายในบัญชี</CardDescription></CardHeader>
              <CardContent><span className="text-sm font-black text-[var(--gold-strong)]">จัดการโปรไฟล์ →</span></CardContent>
            </Card>
          </Link>
          <Link href="/settings/security" className="block">
            <Card className="h-full hover:border-[var(--gold-line)]">
              <CardHeader><CardTitle>ความปลอดภัย</CardTitle><CardDescription>เปลี่ยนรหัสผ่าน ตรวจ session และออกจากระบบทุกอุปกรณ์</CardDescription></CardHeader>
              <CardContent><span className="text-sm font-black text-[var(--gold-strong)]">จัดการความปลอดภัย →</span></CardContent>
            </Card>
          </Link>
          <Link href="/verification" className="block">
            <Card className="h-full hover:border-[var(--gold-line)]">
              <CardHeader><CardTitle>ยืนยันตัวตน</CardTitle><CardDescription>KYC สำหรับสิทธิ์ลงของและยืมของ สถานะปัจจุบัน: {user.verificationStatus}</CardDescription></CardHeader>
              <CardContent><span className="text-sm font-black text-[var(--gold-strong)]">ดู Trust & identity →</span></CardContent>
            </Card>
          </Link>
          <Link href="/notifications" className="block">
            <Card className="h-full hover:border-[var(--gold-line)]">
              <CardHeader><CardTitle>การแจ้งเตือน</CardTitle><CardDescription>ติดตามคำขอยืม แชท การชำระเงิน การรับคืน และกิจกรรมสำคัญ</CardDescription></CardHeader>
              <CardContent><span className="text-sm font-black text-[var(--gold-strong)]">เปิด Notification Center →</span></CardContent>
            </Card>
          </Link>
          {!summary?.email_verified && (
            <Link href="/verify-email" className="block md:col-span-2">
              <Card className="border-[var(--gold-line)] bg-[var(--gold-soft)]">
                <CardHeader><CardTitle>ยืนยันอีเมลให้เรียบร้อย</CardTitle><CardDescription>เพิ่มความปลอดภัยให้บัญชีและเตรียมพร้อมสำหรับการใช้งาน production flow</CardDescription></CardHeader>
                <CardContent><span className="text-sm font-black text-[var(--gold-strong)]">ไปหน้ายืนยันอีเมล →</span></CardContent>
              </Card>
            </Link>
          )}
          <Card className="md:col-span-2">
            <CardHeader><CardTitle>ข้อมูลบัญชี</CardTitle><CardDescription>ข้อมูลส่วนนี้ใช้ระบุตัวบัญชีและไม่แสดงเป็นข้อมูลสาธารณะโดยตรง</CardDescription></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-[var(--surface-2)] p-4"><p className="text-xs font-bold text-[var(--muted)]">อีเมล</p><p className="mt-1 truncate text-sm font-black">{user.email}</p></div>
              <div className="rounded-xl bg-[var(--surface-2)] p-4"><p className="text-xs font-bold text-[var(--muted)]">บทบาท</p><p className="mt-1 text-sm font-black">{user.role}</p></div>
              <div className="rounded-xl bg-[var(--surface-2)] p-4"><p className="text-xs font-bold text-[var(--muted)]">KYC</p><p className="mt-1 text-sm font-black">{user.verificationStatus}</p></div>
            </CardContent>
          </Card>
          <div className="md:col-span-2 flex flex-wrap gap-3 text-sm font-black">
            <Link href="/profile" className="text-[var(--gold-strong)]">กลับโปรไฟล์ของฉัน →</Link>
            <Link href={`/users/${user.id}`} className="text-[var(--gold-strong)]">ดู Public Profile →</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
