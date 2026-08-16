export type VerificationStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
export type UserRole = "USER" | "ADMIN" | "SUPERADMIN";

export type MockUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  verificationStatus: VerificationStatus;
};

export type VerificationRequest = {
  id: string;
  userId: string;
  submittedAt: string;
  status: VerificationStatus;
  note?: string;
};

// Legacy prototype fixture only. PostgreSQL is the application source of truth.
export const mockDb = {
  users: [
    { id: "u_001", email: "demo@example.com", name: "Demo User", role: "USER", verificationStatus: "PENDING" },
    { id: "u_002", email: "verified@example.com", name: "Verified User", role: "USER", verificationStatus: "VERIFIED" },
  ] as MockUser[],
  verificationRequests: [
    { id: "v_001", userId: "u_001", submittedAt: "2026-08-10T09:00:00.000Z", status: "PENDING" },
  ] as VerificationRequest[],
};
