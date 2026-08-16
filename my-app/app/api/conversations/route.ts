import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireUser } from "@/lib/auth/authorization";
import { ChatError, listConversationsForUser } from "@/lib/chat/service";

function chatErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof ChatError)) return null;
  return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const conversations = await listConversationsForUser(user.id);
    const requestedRentalId = new URL(request.url).searchParams.get("rentalRequestId")?.trim() || null;
    const selectedConversationId = requestedRentalId
      ? conversations.find((conversation) => conversation.rentalRequestId === requestedRentalId)?.id ?? null
      : null;
    return NextResponse.json({ ok: true, conversations, selectedConversationId });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    const chatResponse = chatErrorResponse(error);
    if (chatResponse) return chatResponse;
    console.error("Failed to list conversations", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to list conversations" }, { status: 500 });
  }
}
