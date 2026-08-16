import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireUser } from "@/lib/auth/authorization";
import {
  getKycProviderState,
  KycProviderWorkflowError,
  startConfiguredVerification,
} from "@/lib/verification/provider";
import {
  getVerificationOverview,
  VerificationWorkflowError,
} from "@/lib/verification/service";

function workflowErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof VerificationWorkflowError || error instanceof KycProviderWorkflowError) {
    return NextResponse.json(
      { ok: false, code: error.code, message: error.message },
      { status: error.status },
    );
  }
  return null;
}

export async function GET() {
  try {
    const user = await requireUser();
    const overview = await getVerificationOverview(user.id);
    return NextResponse.json({
      ok: true,
      ...overview,
      provider: getKycProviderState(),
    });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    const workflowResponse = workflowErrorResponse(error);
    if (workflowResponse) return workflowResponse;
    console.error("Failed to load verification overview", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", message: "Unable to load verification status" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    let consent = false;
    try {
      const body = (await request.json()) as { consent?: unknown };
      consent = body.consent === true;
    } catch {
      // Backwards-compatible manual flow: existing clients may submit an empty body.
    }

    const result = await startConfiguredVerification({ userId: user.id, consent });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    const workflowResponse = workflowErrorResponse(error);
    if (workflowResponse) return workflowResponse;
    console.error("Failed to start verification", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", message: "Unable to start verification" },
      { status: 500 },
    );
  }
}
