import { requireVerifiedUserPage } from "@/lib/auth/authorization";
import CheckoutClient from "./checkout-client";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ rentalRequestId: string }>;
}) {
  const { rentalRequestId } = await params;
  const user = await requireVerifiedUserPage(`/checkout/${rentalRequestId}`);
  return <CheckoutClient rentalRequestId={rentalRequestId} displayName={user.displayName} />;
}
