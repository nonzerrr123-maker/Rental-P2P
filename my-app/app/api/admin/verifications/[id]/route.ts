import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireAdmin } from "@/lib/auth/authorization";
import {
  reviewVerification,
  VerificationWorkflowError,
} from "@/lib/verification/service";

type ReviewBody = {
  decision?: "VERIFIED" | "REJECTED";
  rejectionReason?: string;
};

function verificationErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof VerificationWorkflowError)) return null;
  return NextResponse.json(
    { ok: false, code: error.code, message: error.message },
    { status: error.status },
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const reviewer = await requireAdmin();
    const { id } = await params;
    const body = (await request.json()) as ReviewBody;

    if (body.decision !== "VERIFIED" && body.decision !== "REJECTED") {
      return NextResponse.json(
        { ok: false, code: "INVALID_DECISION", message: "Decision must be VERIFIED or REJECTED" },
        { status: 400 },
      );
    }

    const verification = await reviewVerification({
      verificationId: id,
      reviewerId: reviewer.id,
      decision: body.decision,
      rejectionReason: body.rejectionReason,
    });

    return NextResponse.json({ ok: true, verification });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    const verificationResponse = verificationErrorResponse(error);
    if (verificationResponse) return verificationResponse;
    console.error("Failed to review verification request", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", message: "Unable to review verification request" },
      { status: 500 },
    );
  }
}
