import type { Listing, Notification, Rental, User } from "./schema";

export const mockUsers: User[] = [
  { id: "u-admin", email: "admin@example.com", displayName: "Super Admin", role: "SUPERADMIN", verificationStatus: "APPROVED", province: "อุบลราชธานี", district: "เมืองอุบลราชธานี", tambon: "ในเมือง", lat: 15.2287, lng: 104.8564, createdAt: "2026-08-10T08:00:00Z" },
  { id: "u-001", email: "somchai@example.com", displayName: "Somchai", role: "USER", verificationStatus: "APPROVED", province: "อุบลราชธานี", district: "เมืองอุบลราชธานี", tambon: "ในเมือง", lat: 15.2287, lng: 104.8564, createdAt: "2026-08-10T08:00:00Z" },
];

export const mockListings: Listing[] = [
  { id: "L-001", ownerId: "u-001", title: "PlayStation 5", description: "เครื่องพร้อมจอย 2 ตัว", category: "เกม", pricePerDay: 700, deposit: 3000, province: "อุบลราชธานี", district: "เมืองอุบลราชธานี", tambon: "ในเมือง", lat: 15.2287, lng: 104.8564, status: "ACTIVE", createdAt: "2026-08-10T08:00:00Z" },
  { id: "L-002", ownerId: "u-001", title: "เต็นท์ 4 คน", description: "เต็นท์สำหรับแคมป์ปิ้ง", category: "แคมป์ปิ้ง", pricePerDay: 500, deposit: 1500, province: "อุบลราชธานี", district: "เมืองอุบลราชธานี", tambon: "แจระแม", lat: 15.238, lng: 104.816, status: "ACTIVE", createdAt: "2026-08-10T08:00:00Z" },
];

export const mockRentals: Rental[] = [
  { id: "R-0001", listingId: "L-001", borrowerId: "u-001", lenderId: "u-admin", startDate: "2026-08-12", endDate: "2026-08-15", rentalAmount: 2100, depositAmount: 3000, totalAmount: 5100, status: "BORROWING", createdAt: "2026-08-10T08:00:00Z", updatedAt: "2026-08-10T08:00:00Z" },
];

export const mockNotifications: Notification[] = [
  { id: "N-001", userId: "u-001", type: "RENTAL_ACCEPTED", title: "คำขอยืมได้รับการอนุมัติ", body: "Rental R-0001 ได้รับการอนุมัติแล้ว", read: false, relatedId: "R-0001", createdAt: "2026-08-10T08:00:00Z" },
];
