import { requireVerifiedUserPage } from "@/lib/auth/authorization";
import LendForm from "./lend-form";
import UrgentListingManager from "./urgent-listing-manager";

export default async function LendPage() {
  await requireVerifiedUserPage("/lend");
  return (
    <>
      <LendForm />
      <UrgentListingManager />
    </>
  );
}
