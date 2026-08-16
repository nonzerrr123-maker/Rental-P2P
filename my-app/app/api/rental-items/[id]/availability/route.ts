import { NextResponse } from "next/server";
import { BookingError, getRentalAvailability } from "@/lib/rental/bookings";
import { expireStaleUrgentReservations } from "@/lib/rental/urgent";

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await expireStaleUrgentReservations(id);
    const url = new URL(request.url);
    const availability = await getRentalAvailability(
      id,
      url.searchParams.get("from"),
      url.searchParams.get("to"),
    );
    return NextResponse.json({ ok: true, availability });
  } catch (error) {
    const response = bookingErrorResponse(error);
    if (response) return response;
    console.error("Failed to read rental availability", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", message: "Unable to read rental availability" },
      { status: 500 },
    );
  }
}
