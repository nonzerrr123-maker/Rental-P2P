import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireUser } from "@/lib/auth/authorization";
import { ChatError, listMessages, sendMessage } from "@/lib/chat/service";

function chatErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof ChatError)) return null;
  return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const url = new URL(request.url);
    const result = await listMessages(user.id, id, {
      before: url.searchParams.get("before") || undefined,
      after: url.searchParams.get("after") || undefined,
      limit: Number(url.searchParams.get("limit") || 50),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    const chatResponse = chatErrorResponse(error);
    if (chatResponse) return chatResponse;
    console.error("Failed to list chat messages", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to list chat messages" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, code: "INVALID_JSON", message: "Request body must be valid JSON" }, { status: 400 });
    }
    const messageBody = body && typeof body === "object" ? (body as Record<string, unknown>).body : undefined;
    const message = await sendMessage(user.id, id, messageBody);
    return NextResponse.json({ ok: true, message }, { status: 201 });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    const chatResponse = chatErrorResponse(error);
    if (chatResponse) return chatResponse;
    console.error("Failed to send chat message", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to send chat message" }, { status: 500 });
  }
}
