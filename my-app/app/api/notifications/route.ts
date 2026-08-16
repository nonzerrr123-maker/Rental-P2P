import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireUser } from "@/lib/auth/authorization";
import { listNotificationsForUser, markAllNotificationsRead } from "@/lib/notifications/service";
import { synchronizeCommunicationForUser } from "@/lib/rental/communication";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    await synchronizeCommunicationForUser(user.id);
    const limit = Number(new URL(request.url).searchParams.get("limit") || 50);
    const result = await listNotificationsForUser(user.id, limit);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Failed to list notifications", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to list notifications" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const action = body && typeof body === "object" ? String((body as Record<string, unknown>).action || "") : "";
    if (action !== "MARK_ALL_READ") {
      return NextResponse.json({ ok: false, code: "VALIDATION_ERROR", message: "Unsupported notification action" }, { status: 400 });
    }
    const marked = await markAllNotificationsRead(user.id);
    return NextResponse.json({ ok: true, marked });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Failed to update notifications", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to update notifications" }, { status: 500 });
  }
}
