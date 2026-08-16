import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireUser } from "@/lib/auth/authorization";
import {
  KycProviderWorkflowError,
  resumePersonaVerification,
} from "@/lib/verification/provider";

export async function POST() {
  try {
    const user = await requireUser();
    const redirectUrl = await resumePersonaVerification(user.id);
    return NextResponse.json({ ok: true, redirectUrl });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof KycProviderWorkflowError) {
      return NextResponse.json(
        { ok: false, code: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("Failed to resume Persona verification", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", message: "Unable to resume verification" },
      { status: 500 },
    );
  }
}
