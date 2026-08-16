export type Booking = {
  start: string;
  end: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
};

export const existingBookings: Booking[] = [
  { start: "2026-08-20", end: "2026-08-22", status: "ACCEPTED" },
];

export function overlaps(start: string, end: string, bookings: Booking[]) {
  return bookings.some(
    (booking) => booking.status !== "REJECTED" && start < booking.end && end > booking.start,
  );
}
