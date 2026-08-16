import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireVerifiedUser } from "@/lib/auth/authorization";
import { FulfillmentError, getHandoverEvidence } from "@/lib/rental/fulfillment";

function fulfillmentErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof FulfillmentError)) return null;
  return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; eventId: string; index: string }> },
) {
  try {
    const user = await requireVerifiedUser();
    const { id, eventId, index } = await params;
    const stored = await getHandoverEvidence(user, id, eventId, index);
    const headers = new Headers();
    headers.set("Content-Type", stored.headers.get("content-type") || "application/octet-stream");
    headers.set("Cache-Control", "private, max-age=60");
    return new Response(stored.body, { status: 200, headers });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    const fulfillmentResponse = fulfillmentErrorResponse(error);
    if (fulfillmentResponse) return fulfillmentResponse;
    console.error("Failed to load handover evidence", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to load evidence" }, { status: 500 });
  }
}
