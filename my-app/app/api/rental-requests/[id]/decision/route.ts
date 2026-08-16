import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireUser } from "@/lib/auth/authorization";
import { BookingError, decideRentalRequest } from "@/lib/rental/bookings";

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
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
    const decision = body && typeof body === "object"
      ? (body as Record<string, unknown>).decision
      : undefined;
    const rentalRequest = await decideRentalRequest(user.id, id, decision);
    return NextResponse.json({ ok: true, request: rentalRequest });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    const bookingResponse = bookingErrorResponse(error);
    if (bookingResponse) return bookingResponse;
    console.error("Failed to decide rental request", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", message: "Unable to decide rental request" },
      { status: 500 },
    );
  }
}
