import { NextResponse } from "next/server";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ ok: false, message: "กรุณากรอกอีเมลและรหัสผ่าน" }, { status: 400 });
  }

  // Bootstrap account only. It is a SUPERADMIN, not a normal user and does not bypass
  // the approval workflow for users/admin applicants.
  if (ADMIN_EMAIL && ADMIN_PASSWORD && email === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
    const response = NextResponse.json({ ok: true, role: "SUPERADMIN", verificationStatus: "APPROVED", redirect: "/admin" });
    response.cookies.set("rental_role", "SUPERADMIN", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
    response.cookies.set("rental_verification", "APPROVED", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
    return response;
  }

  // Prototype authentication: every normal account starts as PENDING.
  // A real user store will replace this adapter before production.
  const response = NextResponse.json({ ok: true, role: "USER", verificationStatus: "PENDING", redirect: "/verification" });
  response.cookies.set("rental_role", "USER", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
  response.cookies.set("rental_verification", "PENDING", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
  return response;
}
