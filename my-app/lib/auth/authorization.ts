import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentUser, type AuthUser } from "@/lib/auth/session";

export class AuthorizationError extends Error {
  constructor(
    public readonly status: 401 | 403,
    public readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "VERIFICATION_REQUIRED",
    message: string,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

function hasRentalAccess(user: AuthUser): boolean {
  return (
    user.role === "ADMIN" ||
    user.role === "SUPERADMIN" ||
    user.verificationStatus === "VERIFIED"
  );
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthorizationError(401, "UNAUTHENTICATED", "Authentication required");
  }
  return user;
}

export async function requireVerifiedUser(): Promise<AuthUser> {
  const user = await requireUser();
  if (!hasRentalAccess(user)) {
    throw new AuthorizationError(403, "VERIFICATION_REQUIRED", "Identity verification required");
  }
  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN" && user.role !== "SUPERADMIN") {
    throw new AuthorizationError(403, "FORBIDDEN", "Administrator access required");
  }
  return user;
}

export function assertResourceOwner(user: AuthUser, ownerId: string): void {
  if (user.id !== ownerId && user.role !== "ADMIN" && user.role !== "SUPERADMIN") {
    throw new AuthorizationError(403, "FORBIDDEN", "You do not own this resource");
  }
}

export function assertParticipant(user: AuthUser, participantIds: readonly string[]): void {
  if (
    !participantIds.includes(user.id) &&
    user.role !== "ADMIN" &&
    user.role !== "SUPERADMIN"
  ) {
    throw new AuthorizationError(403, "FORBIDDEN", "You are not a participant in this resource");
  }
}

export function authorizationErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof AuthorizationError)) return null;
  return NextResponse.json(
    { ok: false, code: error.code, message: error.message },
    { status: error.status },
  );
}

function loginUrl(nextPath: string): string {
  return `/login?next=${encodeURIComponent(nextPath)}`;
}

export async function requireUserPage(nextPath: string): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect(loginUrl(nextPath));
  return user;
}

export async function requireVerifiedUserPage(nextPath: string): Promise<AuthUser> {
  const user = await requireUserPage(nextPath);
  if (!hasRentalAccess(user)) redirect("/verification");
  return user;
}

export async function requireAdminPage(nextPath: string): Promise<AuthUser> {
  const user = await requireUserPage(nextPath);
  if (user.role !== "ADMIN" && user.role !== "SUPERADMIN") redirect("/");
  return user;
}
