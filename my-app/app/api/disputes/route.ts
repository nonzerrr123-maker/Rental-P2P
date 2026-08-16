import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireVerifiedUser } from "@/lib/auth/authorization";
import { DisputeError, listDisputesForUser, openDispute } from "@/lib/rental/disputes";

function disputeErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof DisputeError)) return null;
  return NextResponse.json({ ok: false, code: error.code, message: error.message, fieldErrors: error.fieldErrors }, { status: error.status });
}

export async function GET() {
  try {
    const user = await requireVerifiedUser();
    return NextResponse.json({ ok: true, disputes: await listDisputesForUser(user) });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    const response = disputeErrorResponse(error);
    if (response) return response;
    console.error("Failed to list disputes", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to list disputes" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser();
    const form = await request.formData();
    const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);
    const dispute = await openDispute(user, {
      rentalRequestId: form.get("rentalRequestId"), reason: form.get("reason"), details: form.get("details"), files,
    });
    return NextResponse.json({ ok: true, dispute }, { status: 201 });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    const response = disputeErrorResponse(error);
    if (response) return response;
    console.error("Failed to open dispute", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to open dispute" }, { status: 500 });
  }
}
