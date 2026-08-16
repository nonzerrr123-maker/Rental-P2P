import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireUser } from "@/lib/auth/authorization";
import {
  getVerificationOverview,
  submitManualVerification,
  VerificationWorkflowError,
} from "@/lib/verification/service";

function verificationErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof VerificationWorkflowError)) return null;
  return NextResponse.json(
    { ok: false, code: error.code, message: error.message },
    { status: error.status },
  );
}

export async function GET() {
  try {
    const user = await requireUser();
    const overview = await getVerificationOverview(user.id);
    return NextResponse.json({ ok: true, ...overview });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    const verificationResponse = verificationErrorResponse(error);
    if (verificationResponse) return verificationResponse;
    console.error("Failed to load verification overview", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", message: "Unable to load verification status" },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const user = await requireUser();
    const verification = await submitManualVerification(user.id);
    return NextResponse.json({ ok: true, verification }, { status: 201 });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    const verificationResponse = verificationErrorResponse(error);
    if (verificationResponse) return verificationResponse;
    console.error("Failed to submit verification request", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", message: "Unable to submit verification request" },
      { status: 500 },
    );
  }
}
