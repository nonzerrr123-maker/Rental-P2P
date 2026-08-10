export type UserRole = "USER" | "ADMIN" | "SUPERADMIN";
export type VerificationStatus = "PENDING" | "APPROVED" | "REJECTED";
export type RentalStatus = "PENDING" | "ACCEPTED" | "WAITING_PAYMENT" | "PAID" | "WAITING_PICKUP" | "BORROWING" | "RETURN_PENDING" | "RETURNED" | "COMPLETED" | "REJECTED" | "CANCELLED" | "DISPUTED";
export type PaymentStatus = "PENDING" | "PAID" | "REFUNDED" | "FAILED";

export interface User { id: string; email: string; displayName: string; role: UserRole; verificationStatus: VerificationStatus; province?: string; district?: string; tambon?: string; lat?: number; lng?: number; createdAt: string; }
export interface VerificationRequest { id: string; userId: string; idCardImage?: string; faceImage?: string; status: VerificationStatus; reviewedBy?: string; reviewedAt?: string; createdAt: string; }
export interface Listing { id: string; ownerId: string; title: string; description: string; category: string; pricePerDay: number; deposit: number; province: string; district: string; tambon: string; lat: number; lng: number; status: "ACTIVE" | "PAUSED" | "RENTED"; createdAt: string; }
export interface Rental { id: string; listingId: string; borrowerId: string; lenderId: string; startDate: string; endDate: string; rentalAmount: number; depositAmount: number; totalAmount: number; status: RentalStatus; createdAt: string; updatedAt: string; }
export interface Payment { id: string; rentalId: string; payerId: string; amount: number; type: "RENTAL" | "DEPOSIT" | "RENTAL_DEPOSIT" | "REFUND"; status: PaymentStatus; createdAt: string; }
export interface Conversation { id: string; rentalId: string; participantIds: string[]; updatedAt: string; }
export interface Message { id: string; conversationId: string; senderId: string; body: string; createdAt: string; readBy: string[]; }
export interface Review { id: string; rentalId: string; reviewerId: string; revieweeId: string; rating: number; comment?: string; createdAt: string; }
export interface Dispute { id: string; rentalId: string; openedBy: string; reason: string; detail: string; status: "PENDING_REVIEW" | "RESOLVED"; resolvedBy?: string; resolvedAt?: string; createdAt: string; }
export interface Notification { id: string; userId: string; type: string; title: string; body: string; read: boolean; relatedId?: string; createdAt: string; }

export const collections = ["users", "verification_requests", "listings", "rentals", "payments", "conversations", "messages", "reviews", "disputes", "notifications"] as const;
