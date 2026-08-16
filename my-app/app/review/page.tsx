import { redirect } from "next/navigation";
import { requireVerifiedUserPage } from "@/lib/auth/authorization";
import { getReviewContext } from "@/lib/rental/reviews";
import ReviewClient from "./review-client";

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ rentalRequestId?: string }> }) {
  const params = await searchParams;
  const rentalRequestId = params.rentalRequestId?.trim();
  if (!rentalRequestId) redirect("/dashboard");
  const user = await requireVerifiedUserPage(`/review?rentalRequestId=${encodeURIComponent(rentalRequestId)}`);
  const context = await getReviewContext(user, rentalRequestId);
  return <ReviewClient initialContext={context} />;
}
