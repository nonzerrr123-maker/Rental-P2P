import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireVerifiedUser } from "@/lib/auth/authorization";
import {
  CommunityError,
  createCommunityOffer,
  listCommunityOffersForViewer,
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
    const user = await requireVerifiedUser();
    const { id } = await params;
    const offers = await listCommunityOffersForViewer(user.id, id);
    return NextResponse.json({ ok: true, offers }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    if (auth) return auth;
    const community = communityErrorResponse(error);
    if (community) return community;
    console.error("Failed to load community offers", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to load community offers" }, { status: 500 });
  }
}

export async function POST(
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
      return NextResponse.json({ ok: false, code: "INVALID_JSON", message: "Request body must be valid JSON" }, { status: 400 });
    }
    const offer = await createCommunityOffer(user.id, id, body);
    return NextResponse.json({ ok: true, offer }, { status: 201 });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    if (auth) return auth;
    const community = communityErrorResponse(error);
    if (community) return community;
    console.error("Failed to create community offer", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to create community offer" }, { status: 500 });
  }
}
