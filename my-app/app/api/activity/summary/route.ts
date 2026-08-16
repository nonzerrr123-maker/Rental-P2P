import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireUser } from "@/lib/auth/authorization";
import { getChatUnreadCount } from "@/lib/chat/service";
import { getNotificationUnreadCount } from "@/lib/notifications/service";
import { synchronizeCommunicationForUser } from "@/lib/rental/communication";
import { expireStaleUrgentReservations } from "@/lib/rental/urgent";

export async function GET() {
  try {
    const user = await requireUser();
    await expireStaleUrgentReservations();
    await synchronizeCommunicationForUser(user.id);
    const [chatUnread, notificationUnread] = await Promise.all([
      getChatUnreadCount(user.id),
      getNotificationUnreadCount(user.id),
    ]);
    return NextResponse.json({ ok: true, chatUnread, notificationUnread });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Failed to load activity summary", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to load activity summary" }, { status: 500 });
  }
}
