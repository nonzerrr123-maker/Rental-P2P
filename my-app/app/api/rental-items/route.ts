import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireVerifiedUser } from "@/lib/auth/authorization";
import {
  createRentalListing,
  RentalListingValidationError,
} from "@/lib/rental/listings";

function listingErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof RentalListingValidationError)) return null;
  return NextResponse.json(
    {
      ok: false,
      code: error.code,
      message: error.message,
      fieldErrors: error.fieldErrors,
    },
    { status: error.status },
  );
}

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, code: "INVALID_JSON", message: "Request body must be valid JSON" },
        { status: 400 },
      );
    }

    const item = await createRentalListing(user.id, body);
    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    const listingResponse = listingErrorResponse(error);
    if (listingResponse) return listingResponse;
    console.error("Failed to create rental listing", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", message: "Unable to create rental listing" },
      { status: 500 },
    );
  }
}
