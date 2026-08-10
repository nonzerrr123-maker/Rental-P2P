export type VerificationStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
export type RentalStatus = "REQUESTED" | "ACCEPTED" | "REJECTED" | "PAID" | "PICKUP" | "RENTING" | "RETURNING" | "RETURNED" | "COMPLETED" | "DISPUTED" | "CANCELLED";
export type ItemCondition = "NEW" | "LIKE_NEW" | "GOOD" | "FAIR" | "USED";

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  phone?: string;
  verificationStatus: VerificationStatus;
  rating: number;
  completedRentals: number;
}

export interface RentalItem {
  id: string;
  ownerId: string;
  title: string;
  category: string;
  description: string;
  dailyRate: number;
  weeklyRate?: number;
  deposit: number;
  condition: ItemCondition;
  location: string;
  available: boolean;
  images: string[];
}

export interface RentalRequest {
  id: string;
  itemId: string;
  lenderId: string;
  borrowerId: string;
  startDate: string;
  endDate: string;
  rentalFee: number;
  deposit: number;
  status: RentalStatus;
}
