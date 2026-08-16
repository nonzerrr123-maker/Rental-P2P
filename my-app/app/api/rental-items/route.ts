import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireVerifiedUser } from "@/lib/auth/authorization";
import {
  createRentalListing,
  RentalListingValidationError,
} from "@/lib/rental/listings";
import {
  MarketplaceValidationError,
  parseMarketplaceFilters,
  searchPublicRentalItems,
} from "@/lib/rental/marketplace";

function listingErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof RentalListingValidationError)) return null;
  return NextResponse.json(
    {
      ok: false,
      code: error.code,
      message: error.message,
      fieldErrors: error.fieldErrors,
    },
    { status: 400 },
  );
}

function marketplaceErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof MarketplaceValidationError)) return null;
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

export async function GET(request: Request) {
  try {
    const filters = parseMarketplaceFilters(new URL(request.url).searchParams);
    const result = await searchPublicRentalItems(filters);
    return NextResponse.json({ ok: true, ...result }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const response = marketplaceErrorResponse(error);
    if (response) return response;
    console.error("Failed to search rental marketplace", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", message: "Unable to load rental marketplace" },
      { status: 500 },
    );
  }
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
