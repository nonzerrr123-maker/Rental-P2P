import { redirect } from "next/navigation";
import { requireVerifiedUserPage } from "@/lib/auth/authorization";
import { listDisputesForUser } from "@/lib/rental/disputes";
import { getRentalFulfillment } from "@/lib/rental/fulfillment";
import DisputeClient from "./dispute-client";

export default async function DisputePage({ searchParams }: { searchParams: Promise<{ rentalRequestId?: string }> }) {
  const params = await searchParams;
  const rentalRequestId = params.rentalRequestId?.trim();
  if (!rentalRequestId) redirect("/dashboard");
  const user = await requireVerifiedUserPage(`/dispute?rentalRequestId=${encodeURIComponent(rentalRequestId)}`);
  const [rental, disputes] = await Promise.all([getRentalFulfillment(user, rentalRequestId), listDisputesForUser(user)]);
  const activeOrLatest = disputes.find((item) => item.rentalRequestId === rentalRequestId && ["OPEN", "UNDER_REVIEW"].includes(item.status))
    ?? disputes.find((item) => item.rentalRequestId === rentalRequestId)
    ?? null;
  return <DisputeClient rentalRequestId={rental.id} itemTitle={rental.item.title} initialDispute={activeOrLatest} />;
}
