import { notFound } from "next/navigation";
import SiteHeader from "@/components/site-header";
import { requireVerifiedUserPage } from "@/lib/auth/authorization";
import {
  getOwnerRentalListing,
  RentalListingMutationError,
} from "@/lib/rental/listing-edits";
import EditListingForm from "./edit-listing-form";

export default async function EditRentalListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireVerifiedUserPage(`/lend/${id}/edit`);
  let item;
  try {
    item = await getOwnerRentalListing(user.id, id);
  } catch (error) {
    if (error instanceof RentalListingMutationError && error.status === 404) notFound();
    throw error;
  }

  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <EditListingForm item={item}/>
      </div>
    </main>
  );
}
