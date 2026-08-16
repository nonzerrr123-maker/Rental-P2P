import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireAdmin } from "@/lib/auth/authorization";
import { listVerificationQueue } from "@/lib/verification/service";

export async function GET() {
  try {
    await requireAdmin();
    const queue = await listVerificationQueue();
    return NextResponse.json({ ok: true, ...queue });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Failed to load admin verification queue", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", message: "Unable to load verification queue" },
      { status: 500 },
    );
  }
}
