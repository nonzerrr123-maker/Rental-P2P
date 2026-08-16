import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireUser } from "@/lib/auth/authorization";
import { markNotificationRead } from "@/lib/notifications/service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const updated = await markNotificationRead(user.id, id);
    if (!updated) {
      return NextResponse.json({ ok: false, code: "NOT_FOUND", message: "Notification not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Failed to mark notification read", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to mark notification read" }, { status: 500 });
  }
}
