import { NextResponse } from "next/server";
import {
  authorizationErrorResponse,
  requireVerifiedUser,
} from "@/lib/auth/authorization";
import {
  RentalLocationValidationError,
  updateRentalItemLocation,
} from "@/lib/rental/locations";

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
      return NextResponse.json(
        { ok: false, code: "INVALID_JSON", message: "Request body must be valid JSON" },
        { status: 400 },
      );
    }

    const location = await updateRentalItemLocation(user, id, body);
    return NextResponse.json({ ok: true, location });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    if (error instanceof RentalLocationValidationError) {
      return NextResponse.json(
        { ok: false, code: error.code, message: error.message, fieldErrors: error.fieldErrors },
        { status: error.status },
      );
    }
    if (error instanceof Error && error.name === "RentalLocationNotFoundError") {
      return NextResponse.json(
        { ok: false, code: "NOT_FOUND", message: "Rental item not found" },
        { status: 404 },
      );
    }
    console.error("Failed to update rental item location", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", message: "Unable to update rental item location" },
      { status: 500 },
    );
  }
}
