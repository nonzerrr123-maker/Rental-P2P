import Link from "next/link";
import type { QueryResultRow } from "pg";
import SiteHeader from "@/components/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionEyebrow } from "@/components/ui/primitives";
import { requireUserPage } from "@/lib/auth/authorization";
import { query } from "@/lib/db";
import SecuritySettingsClient from "./security-settings-client";

type SessionCountRow = QueryResultRow & { active_sessions: string };

export default async function SecuritySettingsPage() {
  const user = await requireUserPage("/settings/security");
  const result = await query<SessionCountRow>(
    `SELECT count(*)::text AS active_sessions
     FROM user_sessions
     WHERE user_id = $1
       AND revoked_at IS NULL
       AND expires_at > now()`,
    [user.id],
  );

  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <SiteHeader />
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/settings" className="text-xs font-black text-[var(--gold-strong)]">← การตั้งค่า</Link>
        <SectionEyebrow className="mt-6">Security</SectionEyebrow>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.045em]">ความปลอดภัยของบัญชี</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">ควบคุมรหัสผ่านและ session ที่ยังเข้าใช้งานบัญชีได้</p>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Session ที่ยังใช้งานได้</CardTitle>
            <CardDescription>ขณะนี้มี {result.rows[0]?.active_sessions ?? "0"} session ที่ยังไม่หมดอายุหรือถูก revoke</CardDescription>
          </CardHeader>
          <CardContent><SecuritySettingsClient /></CardContent>
        </Card>
      </div>
    </main>
  );
}
