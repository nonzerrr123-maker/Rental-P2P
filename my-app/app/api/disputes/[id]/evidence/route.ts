import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireVerifiedUser } from "@/lib/auth/authorization";
import { addDisputeEvidence, DisputeError } from "@/lib/rental/disputes";

function disputeErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof DisputeError)) return null;
  return NextResponse.json({ ok: false, code: error.code, message: error.message, fieldErrors: error.fieldErrors }, { status: error.status });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireVerifiedUser();
    const { id } = await params;
    const form = await request.formData();
    const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);
    const dispute = await addDisputeEvidence(user, id, form.get("description"), files);
    return NextResponse.json({ ok: true, dispute });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    const response = disputeErrorResponse(error);
    if (response) return response;
    console.error("Failed to add dispute evidence", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to add evidence" }, { status: 500 });
  }
}
