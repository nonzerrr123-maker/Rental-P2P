import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireVerifiedUser } from "@/lib/auth/authorization";
import { DisputeError, getDisputeEvidence } from "@/lib/rental/disputes";

function disputeErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof DisputeError)) return null;
  return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; evidenceId: string }> }) {
  try {
    const user = await requireVerifiedUser();
    const { id, evidenceId } = await params;
    const stored = await getDisputeEvidence(user, id, evidenceId);
    const headers = new Headers();
    headers.set("Content-Type", stored.headers.get("content-type") || "application/octet-stream");
    headers.set("Cache-Control", "private, max-age=60");
    return new Response(stored.body, { status: 200, headers });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    const response = disputeErrorResponse(error);
    if (response) return response;
    console.error("Failed to read dispute evidence", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to read evidence" }, { status: 500 });
  }
}
