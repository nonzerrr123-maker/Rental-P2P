import { NextResponse } from "next/server";
import type { QueryResultRow } from "pg";
import { query } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  getLoginRedirect,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
  type AuthUser,
  type UserRole,
  type VerificationStatus,
} from "@/lib/auth/session";

export const runtime = "nodejs";

type LoginUserRow = QueryResultRow & {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  role: UserRole;
  verification_status: VerificationStatus;
  is_active: boolean;
};

async function findUserByEmail(email: string): Promise<LoginUserRow | null> {
  const result = await query<LoginUserRow>(
    `SELECT id, email, password_hash, display_name, role, verification_status, is_active
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email],
  );
  return result.rows[0] ?? null;
}

async function bootstrapSuperadmin(email: string, password: string): Promise<LoginUserRow | null> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword || email !== adminEmail || password !== adminPassword) {
    return null;
  }

  const passwordHash = await hashPassword(password);
  const result = await query<LoginUserRow>(
    `INSERT INTO users (email, password_hash, display_name, role, verification_status, is_active)
     VALUES ($1, $2, 'Super Admin', 'SUPERADMIN', 'VERIFIED', true)
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       role = 'SUPERADMIN',
       verification_status = 'VERIFIED',
       is_active = true,
       updated_at = now()
     RETURNING id, email, password_hash, display_name, role, verification_status, is_active`,
    [email, passwordHash],
  );
  return result.rows[0];
}

function toAuthUser(row: LoginUserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    verificationStatus: row.verification_status,
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ ok: false, message: "กรุณากรอกอีเมลและรหัสผ่าน" }, { status: 400 });
  }

  try {
    const bootstrapped = await bootstrapSuperadmin(email, password);
    const userRow = bootstrapped ?? (await findUserByEmail(email));

    if (!userRow) {
      return NextResponse.json({ ok: false, message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
    }
    if (!userRow.is_active) {
      return NextResponse.json({ ok: false, message: "บัญชีนี้ถูกปิดใช้งาน" }, { status: 403 });
    }
    if (!bootstrapped && !(await verifyPassword(password, userRow.password_hash))) {
      return NextResponse.json({ ok: false, message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
    }

    const user = toAuthUser(userRow);
    const token = await createSession(user.id);
    const response = NextResponse.json({
      ok: true,
      user,
      role: user.role,
      verificationStatus: user.verificationStatus,
      redirect: getLoginRedirect(user),
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
    response.cookies.set("rental_role", "", { ...getSessionCookieOptions(0) });
    response.cookies.set("rental_verification", "", { ...getSessionCookieOptions(0) });
    return response;
  } catch (error) {
    console.error("Login failed", error);
    return NextResponse.json({ ok: false, message: "ไม่สามารถเข้าสู่ระบบได้" }, { status: 500 });
  }
}
