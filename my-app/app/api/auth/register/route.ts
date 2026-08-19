import { NextResponse } from "next/server";
import type { QueryResultRow } from "pg";
import { query } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { sendVerificationForUser } from "@/lib/email/auth-workflows";
import { isEmailVerificationRequired, resolveEmailPublicBaseUrl } from "@/lib/email/resend";

export const runtime = "nodejs";

type RegisteredUserRow = QueryResultRow & {
  id: string;
  email: string;
  display_name: string;
  role: "USER";
  verification_status: "UNVERIFIED";
};

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (displayName.length < 2 || displayName.length > 80) {
    return NextResponse.json({ ok: false, message: "ชื่อผู้ใช้งานต้องมี 2-80 ตัวอักษร" }, { status: 400 });
  }
  if (!isValidEmail(email) || email.length > 254) {
    return NextResponse.json({ ok: false, message: "รูปแบบอีเมลไม่ถูกต้อง" }, { status: 400 });
  }
  if (password.length < 8 || password.length > 128) {
    return NextResponse.json({ ok: false, message: "รหัสผ่านต้องมี 8-128 ตัวอักษร" }, { status: 400 });
  }

  try {
    const passwordHash = await hashPassword(password);
    const result = await query<RegisteredUserRow>(
      `INSERT INTO users (email, password_hash, display_name, role, verification_status)
       VALUES ($1, $2, $3, 'USER', 'UNVERIFIED')
       RETURNING id, email, display_name, role, verification_status`,
      [email, passwordHash, displayName],
    );
    const user = result.rows[0];

    const emailVerification = await sendVerificationForUser({
      userId: user.id,
      email: user.email,
      displayName: user.display_name,
      baseUrl: resolveEmailPublicBaseUrl(request),
      enforceCooldown: false,
    });
    const verificationRequired = isEmailVerificationRequired();

    return NextResponse.json(
      {
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          role: user.role,
          verificationStatus: user.verification_status,
        },
        emailVerification: {
          required: verificationRequired,
          sent: emailVerification.sent,
        },
        redirect: verificationRequired ? `/verify-email?email=${encodeURIComponent(user.email)}` : "/login",
      },
      { status: 201 },
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ ok: false, message: "อีเมลนี้ถูกใช้งานแล้ว" }, { status: 409 });
    }
    console.error("Registration failed", error);
    return NextResponse.json({ ok: false, message: "ไม่สามารถสมัครสมาชิกได้" }, { status: 500 });
  }
}
