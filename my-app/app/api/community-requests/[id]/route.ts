import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireVerifiedUser } from "@/lib/auth/authorization";
import {
  CommunityError,
  expireStaleCommunityRequests,
  getCommunityRequest,
  toPublicCommunityRequest,
  updateCommunityRequest,
} from "@/lib/community/service";

function communityErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof CommunityError)) return null;
  return NextResponse.json(
    { ok: false, code: error.code, message: error.message, fieldErrors: error.fieldErrors },
    { status: error.status },
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const item = await getCommunityRequest(id);
    if (!item) return NextResponse.json({ ok: false, code: "NOT_FOUND", message: "Community request not found" }, { status: 404 });
    return NextResponse.json({ ok: true, request: toPublicCommunityRequest(item) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const community = communityErrorResponse(error);
    if (community) return community;
    console.error("Failed to load community request", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to load community request" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireVerifiedUser();
    const { id } = await params;
    await expireStaleCommunityRequests();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, code: "INVALID_JSON", message: "Request body must be valid JSON" }, { status: 400 });
    }
    const item = await updateCommunityRequest(user.id, id, body);
    return NextResponse.json({ ok: true, request: toPublicCommunityRequest(item) });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    if (auth) return auth;
    const community = communityErrorResponse(error);
    if (community) return community;
    console.error("Failed to update community request", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to update community request" }, { status: 500 });
  }
}
