import { NextResponse } from "next/server";
import type { QueryResultRow } from "pg";
import { query } from "@/lib/db";
import { sendVerificationForUser } from "@/lib/email/auth-workflows";
import { getResendConfigurationState, resolveEmailPublicBaseUrl } from "@/lib/email/resend";

export const runtime = "nodejs";

type UserRow = QueryResultRow & {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
};

const GENERIC_MESSAGE = "หากอีเมลนี้มีบัญชีที่ยังไม่ได้ยืนยัน ระบบจะส่งลิงก์ยืนยันให้";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ ok: false, message: "รูปแบบอีเมลไม่ถูกต้อง" }, { status: 400 });
  }
  if (!getResendConfigurationState().configured) {
    return NextResponse.json({ ok: false, code: "EMAIL_PROVIDER_NOT_CONFIGURED", message: "ระบบอีเมลยังไม่พร้อมใช้งาน" }, { status: 503 });
  }

  try {
    const result = await query<UserRow>(
      `SELECT id, email, display_name, is_active FROM users WHERE email = $1 LIMIT 1`,
      [email],
    );
    const user = result.rows[0];
    if (user?.is_active) {
      await sendVerificationForUser({
        userId: user.id,
        email: user.email,
        displayName: user.display_name,
        baseUrl: resolveEmailPublicBaseUrl(request),
      });
    }
    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  } catch (error) {
    console.error("Verification email resend failed", error);
    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  }
}
