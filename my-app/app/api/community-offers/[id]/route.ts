import { NextResponse } from "next/server";
import { authorizationErrorResponse, requireVerifiedUser } from "@/lib/auth/authorization";
import { CommunityError, expireStaleCommunityRequests, updateCommunityOffer } from "@/lib/community/service";

function communityErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof CommunityError)) return null;
  return NextResponse.json(
    { ok: false, code: error.code, message: error.message, fieldErrors: error.fieldErrors },
    { status: error.status },
  );
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
    const offer = await updateCommunityOffer(user.id, id, body);
    return NextResponse.json({ ok: true, offer });
  } catch (error) {
    const auth = authorizationErrorResponse(error);
    if (auth) return auth;
    const community = communityErrorResponse(error);
    if (community) return community;
    console.error("Failed to update community offer", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message: "Unable to update community offer" }, { status: 500 });
  }
}
