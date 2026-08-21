import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireVerifiedUser } from "@/lib/auth/authorization";
import {
  RentalListingMutationError,
  updateOwnerRentalListingStatus,
} from "@/lib/rental/listing-edits";

const actions = {
  PAUSE: "PAUSED",
  RESUME: "ACTIVE",
  ARCHIVE: "ARCHIVED",
  RESTORE: "ACTIVE",
} as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireVerifiedUser();
    const { id } = await params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, code: "INVALID_JSON", message: "Request body must be valid JSON" }, { status: 400 });
    }
    const action = body && typeof body === "object" && "action" in body && typeof body.action === "string"
      ? body.action.trim().toUpperCase()
      : "";
    const status = actions[action as keyof typeof actions];
    if (!status) {
      return NextResponse.json(
        { ok: false, code: "VALIDATION_ERROR", message: "Unknown listing status action" },
        { status: 400 },
      );
    }

    const item = await updateOwnerRentalListingStatus(user.id, id, status);
    return NextResponse.json({ ok: true, item }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    if (auth) return auth;
    if (error instanceof RentalListingMutationError) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
    }
    console.error("Failed to update listing status", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to update listing status" }, { status: 500 });
  }
}
