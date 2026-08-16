import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireVerifiedUser, requireUser } from "@/lib/auth/authorization";
import {
  CommunityError,
  createCommunityRequest,
  parseCommunityRequestFilters,
  searchCommunityRequests,
  toPublicCommunityRequest,
} from "@/lib/community/service";

function communityErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof CommunityError)) return null;
  return NextResponse.json(
    { ok: false, code: error.code, message: error.message, fieldErrors: error.fieldErrors },
    { status: error.status },
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const mine = ["1", "true"].includes((url.searchParams.get("mine") ?? "").toLowerCase());
    let requesterId: string | null = null;
    let defaultStatus: "OPEN" | "ALL" = "OPEN";
    if (mine) {
      const user = await requireUser();
      requesterId = user.id;
      defaultStatus = "ALL";
    }
    const filters = parseCommunityRequestFilters(url.searchParams, { requesterId, defaultStatus });
    const result = await searchCommunityRequests(filters);
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    if (auth) return auth;
    const community = communityErrorResponse(error);
    if (community) return community;
    console.error("Failed to search community requests", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to load community requests" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, code: "INVALID_JSON", message: "Request body must be valid JSON" }, { status: 400 });
    }
    const created = await createCommunityRequest(user.id, body);
    return NextResponse.json({ ok: true, request: toPublicCommunityRequest(created) }, { status: 201 });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    if (auth) return auth;
    const community = communityErrorResponse(error);
    if (community) return community;
    console.error("Failed to create community request", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to create community request" }, { status: 500 });
  }
}
