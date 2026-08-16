import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireAdmin } from "@/lib/auth/authorization";
import { DisputeError, startDisputeReview } from "@/lib/rental/disputes";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    return NextResponse.json({ ok: true, dispute: await startDisputeReview(admin, id) });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof DisputeError) return NextResponse.json({ ok: false, code: error.code, message: error.message, fieldErrors: error.fieldErrors }, { status: error.status });
    console.error("Failed to start dispute review", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to start review" }, { status: 500 });
  }
}
