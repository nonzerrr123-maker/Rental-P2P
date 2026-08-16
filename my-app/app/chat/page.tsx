import { requireUserPage } from "@/lib/auth/authorization";
import ChatClient from "./chat-client";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ rentalRequestId?: string }>;
}) {
  const user = await requireUserPage("/chat");
  const params = await searchParams;
  return (
    <ChatClient
      currentUserId={user.id}
      requestedRentalId={params.rentalRequestId?.trim() || null}
    />
  );
}
