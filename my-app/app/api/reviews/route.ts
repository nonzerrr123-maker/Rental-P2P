import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireVerifiedUser } from "@/lib/auth/authorization";
import { createReview, listReviewsForUser, ReviewError } from "@/lib/rental/reviews";

function reviewErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof ReviewError)) return null;
  return NextResponse.json({ ok: false, code: error.code, message: error.message, fieldErrors: error.fieldErrors }, { status: error.status });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    const result = await listReviewsForUser(userId, url.searchParams.get("limit"));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const response = reviewErrorResponse(error);
    if (response) return response;
    console.error("Failed to list reviews", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to list reviews" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser();
    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ ok: false, code: "INVALID_JSON", message: "Request body must be valid JSON" }, { status: 400 }); }
    const data = body && typeof body === "object" ? body as Record<string, unknown> : {};
    const review = await createReview(user, { rentalRequestId: data.rentalRequestId, rating: data.rating, comment: data.comment });
    return NextResponse.json({ ok: true, review }, { status: 201 });
  } catch (error) {
    const authResponse = authorizationErrorResponse(error);
    if (authResponse) return authResponse;
    const response = reviewErrorResponse(error);
    if (response) return response;
    console.error("Failed to create review", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to create review" }, { status: 500 });
  }
}
