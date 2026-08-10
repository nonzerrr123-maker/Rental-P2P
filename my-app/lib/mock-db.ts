export type VerificationStatus = "PENDING" | "APPROVED" | "REJECTED";
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

// Temporary NoSQL-style document store for the prototype phase.
// Replace this adapter with the production database adapter after the UI/workflows are complete.
export const mockDb = {
  users: [
    { id: "u_001", email: "demo@example.com", name: "Demo User", role: "USER", verificationStatus: "PENDING" },
    { id: "u_002", email: "verified@example.com", name: "Verified User", role: "USER", verificationStatus: "APPROVED" },
  ] as MockUser[],
  verificationRequests: [
    { id: "v_001", userId: "u_001", submittedAt: "2026-08-10T09:00:00.000Z", status: "PENDING" },
  ] as VerificationRequest[],
};
