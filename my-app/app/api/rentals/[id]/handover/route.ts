import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireVerifiedUser } from "@/lib/auth/authorization";
import { confirmHandover, FulfillmentError } from "@/lib/rental/fulfillment";

function fulfillmentErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof FulfillmentError)) return null;
  return NextResponse.json({ ok: false, code: error.code, message: error.message, fieldErrors: error.fieldErrors }, { status: error.status });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireVerifiedUser();
    const { id } = await params;
    const form = await request.formData();
    const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);
    const rental = await confirmHandover(user, id, form.get("eventType"), form.get("conditionNotes"), files);
    return NextResponse.json({ ok: true, rental });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    const fulfillmentResponse = fulfillmentErrorResponse(error);
    if (fulfillmentResponse) return fulfillmentResponse;
    console.error("Failed to confirm handover", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to confirm handover" }, { status: 500 });
  }
}
