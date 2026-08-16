import { requireVerifiedUserPage } from "@/lib/auth/authorization";
import { getRentalFulfillment } from "@/lib/rental/fulfillment";
import RentalFulfillmentClient from "./rental-fulfillment-client";

export default async function RentalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireVerifiedUserPage(`/rental/${id}`);
  const rental = await getRentalFulfillment(user, id);
  const isAdmin = user.role === "ADMIN" || user.role === "SUPERADMIN";
  return <RentalFulfillmentClient initialRental={rental} actorId={user.id} isAdmin={isAdmin} />;
}
