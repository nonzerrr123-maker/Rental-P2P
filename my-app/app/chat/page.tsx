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
    <>
      <div className="border-b border-[#e6d797] bg-[#fffaf0] px-4 py-2 text-center text-xs font-semibold text-[#806515]">
        ข้อมูลแชตจาก PostgreSQL · near-realtime polling เฉพาะเมื่อเปิดแท็บ
      </div>
      <ChatClient
        currentUserId={user.id}
        requestedRentalId={params.rentalRequestId?.trim() || null}
      />
    </>
  );
}
