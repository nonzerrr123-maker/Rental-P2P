import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireVerifiedUser } from "@/lib/auth/authorization";
import { getPublicRentalItem } from "@/lib/rental/marketplace";
import { RentalListingValidationError } from "@/lib/rental/listings";
import {
  RentalListingMutationError,
  updateOwnerRentalListing,
} from "@/lib/rental/listing-edits";

function editErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof RentalListingValidationError) {
    return NextResponse.json(
      { ok: false, code: error.code, message: error.message, fieldErrors: error.fieldErrors },
      { status: error.status },
    );
  }
  if (error instanceof RentalListingMutationError) {
    return NextResponse.json(
      { ok: false, code: error.code, message: error.message },
      { status: error.status },
    );
  }
  return null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const item = await getPublicRentalItem(id);
    if (!item) {
      return NextResponse.json(
        { ok: false, code: "NOT_FOUND", message: "Rental item not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { ok: true, item },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Failed to load public rental item", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", message: "Unable to load rental item" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireVerifiedUser();
    const { id } = await context.params;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, code: "INVALID_JSON", message: "Request body must be valid JSON" },
        { status: 400 },
      );
    }

    const item = await updateOwnerRentalListing(user.id, id, body);
    return NextResponse.json({ ok: true, item }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    if (auth) return auth;
    const edit = editErrorResponse(error);
    if (edit) return edit;
    console.error("Failed to update rental item", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", message: "Unable to update rental item" },
      { status: 500 },
    );
  }
}
