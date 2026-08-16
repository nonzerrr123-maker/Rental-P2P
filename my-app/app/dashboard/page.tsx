import { requireUserPage } from "@/lib/auth/authorization";
import { listRentalRequestsForUser } from "@/lib/rental/bookings";
import { RentalDashboard } from "./rental-dashboard";

export default async function DashboardPage() {
  const user = await requireUserPage("/dashboard");
  const requests = await listRentalRequestsForUser(user.id);

  return (
    <RentalDashboard
      displayName={user.displayName}
      initialIncoming={requests.incoming}
      initialOutgoing={requests.outgoing}
    />
  );
}
