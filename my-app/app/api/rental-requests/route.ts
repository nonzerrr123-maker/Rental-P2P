import { NextResponse } from "next/server";
import {
  authorizationErrorResponse,
  requireUser,
  requireVerifiedUser,
} from "@/lib/auth/authorization";
import {
  BookingError,
  createRentalRequest,
  listRentalRequestsForUser,
} from "@/lib/rental/bookings";

function bookingErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof BookingError)) return null;
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

export async function GET() {
  try {
    const user = await requireUser();
    const requests = await listRentalRequestsForUser(user.id);
    return NextResponse.json({ ok: true, ...requests });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Failed to list rental requests", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", message: "Unable to list rental requests" },
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
    const rentalRequest = await createRentalRequest(user.id, body);
    return NextResponse.json({ ok: true, request: rentalRequest }, { status: 201 });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    const bookingResponse = bookingErrorResponse(error);
    if (bookingResponse) return bookingResponse;
    console.error("Failed to create rental request", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", message: "Unable to create rental request" },
      { status: 500 },
    );
  }
}
