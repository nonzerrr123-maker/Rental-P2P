import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireUser } from "@/lib/auth/authorization";
import { ChatError, markConversationRead } from "@/lib/chat/service";

function chatErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof ChatError)) return null;
  return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const marked = await markConversationRead(user.id, id);
    return NextResponse.json({ ok: true, marked });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    const chatResponse = chatErrorResponse(error);
    if (chatResponse) return chatResponse;
    console.error("Failed to mark conversation read", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to mark conversation read" }, { status: 500 });
  }
}
