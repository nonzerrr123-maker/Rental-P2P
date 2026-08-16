import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getSessionCookieOptions,
  revokeSessionToken,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      await revokeSessionToken(token);
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE_NAME, "", getSessionCookieOptions(0));
    response.cookies.set("rental_role", "", getSessionCookieOptions(0));
    response.cookies.set("rental_verification", "", getSessionCookieOptions(0));
    return response;
  } catch (error) {
    console.error("Logout failed", error);
    return NextResponse.json({ ok: false, message: "ไม่สามารถออกจากระบบได้" }, { status: 500 });
  }
}
