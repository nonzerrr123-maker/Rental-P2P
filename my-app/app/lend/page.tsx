import { requireVerifiedUserPage } from "@/lib/auth/authorization";
import { listRentalListingsForOwner } from "@/lib/rental/listings";
import LendForm from "./lend-form";
import UrgentListingManager from "./urgent-listing-manager";

export default async function LendPage() {
  const user = await requireVerifiedUserPage("/lend");
  const items = await listRentalListingsForOwner(user.id);
  return (
    <>
      <LendForm />
      <UrgentListingManager initialItems={items} />
    </>
  );
}
