import { requireVerifiedUserPage } from "@/lib/auth/authorization";
import LendForm from "./lend-form";

export default async function LendPage() {
  await requireVerifiedUserPage("/lend");
  return <LendForm />;
}
