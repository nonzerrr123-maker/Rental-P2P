import { requireAdminPage } from "@/lib/auth/authorization";
import { listDisputesForAdmin } from "@/lib/rental/disputes";
import AdminDisputesClient from "./admin-disputes-client";

export default async function AdminDisputes() {
  const admin = await requireAdminPage("/admin/disputes");
  const disputes = await listDisputesForAdmin(admin);
  return <AdminDisputesClient initialItems={disputes} />;
}
