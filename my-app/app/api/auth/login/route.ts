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

  if (ADMIN_EMAIL && ADMIN_PASSWORD && email === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
    const response = NextResponse.json({ ok: true, role: "admin", verified: true, redirect: "/admin" });
    response.cookies.set("rental_role", "admin", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
    response.cookies.set("rental_verified", "true", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
    return response;
  }

  // Temporary authentication foundation until the real database/auth provider is connected.
  const response = NextResponse.json({ ok: true, role: "user", verified: false, redirect: "/verification" });
  response.cookies.set("rental_role", "user", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
  response.cookies.set("rental_verified", "false", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
  return response;
}
