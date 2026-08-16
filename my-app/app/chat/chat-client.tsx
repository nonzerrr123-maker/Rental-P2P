"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { ChatMessage, ConversationSummary } from "@/lib/chat/service";
import ActivityNavLinks from "@/components/activity-nav-links";

const dateTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "short" });
const timeOnly = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit" });
const CLOSED = new Set(["REJECTED", "CANCELLED", "EXPIRED", "COMPLETED"]);

export default function ChatClient({
  currentUserId,
  requestedRentalId,
}: {
  currentUserId: string;
  requestedRentalId: string | null;
}) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const refreshConversations = async () => {
    const suffix = requestedRentalId ? `?rentalRequestId=${encodeURIComponent(requestedRentalId)}` : "";
    const response = await fetch(`/api/conversations${suffix}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || "โหลดรายการแชตไม่สำเร็จ");
    const next = payload.conversations as ConversationSummary[];
    setConversations(next);
    setSelectedId((current) => current || payload.selectedConversationId || next[0]?.id || "");
  };

  const markRead = async (conversationId: string) => {
    if (!conversationId) return;
    await fetch(`/api/conversations/${conversationId}/read`, { method: "POST" }).catch(() => undefined);
  };

  const loadInitialMessages = async (conversationId: string) => {
    if (!conversationId) {
      setMessages([]);
      setHasMore(false);
      return;
    }
    const response = await fetch(`/api/conversations/${conversationId}/messages?limit=50`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || "โหลดข้อความไม่สำเร็จ");
    setMessages(payload.items as ChatMessage[]);
    setHasMore(Boolean(payload.hasMore));
    await markRead(conversationId);
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        await refreshConversations();
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "โหลดแชตไม่สำเร็จ");
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    const run = async () => {
      try {
        await loadInitialMessages(selectedId);
        if (active) setError("");
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "โหลดข้อความไม่สำเร็จ");
      }
    };
    void run();
    return () => { active = false; };
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    const poll = async () => {
      if (document.hidden) return;
      try {
        const lastId = messages.at(-1)?.id;
        if (lastId) {
          const response = await fetch(`/api/conversations/${selectedId}/messages?after=${encodeURIComponent(lastId)}&limit=100`, { cache: "no-store" });
          const payload = await response.json();
          if (response.ok && payload.ok && active && payload.items.length) {
            setMessages((current) => {
              const known = new Set(current.map((message) => message.id));
              return [...current, ...(payload.items as ChatMessage[]).filter((message) => !known.has(message.id))];
            });
            await markRead(selectedId);
          }
        }
        if (active) await refreshConversations();
      } catch {
        // Polling is best effort; the explicit send/load paths still surface errors.
      }
    };
    const interval = window.setInterval(() => void poll(), 4000);
    const onVisibility = () => { if (!document.hidden) void poll(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [selectedId, messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [selectedId, messages.length]);

  const loadOlder = async () => {
    const firstId = messages[0]?.id;
    if (!selectedId || !firstId) return;
    try {
      const response = await fetch(`/api/conversations/${selectedId}/messages?before=${encodeURIComponent(firstId)}&limit=50`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.message || "โหลดข้อความเก่าไม่สำเร็จ");
      setMessages((current) => [...(payload.items as ChatMessage[]), ...current]);
      setHasMore(Boolean(payload.hasMore));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "โหลดข้อความเก่าไม่สำเร็จ");
    }
  };

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = text.trim();
    if (!selectedId || !body || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/conversations/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, senderId: "client-value-is-ignored" }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.message || "ส่งข้อความไม่สำเร็จ");
      const message = payload.message as ChatMessage;
      setMessages((current) => current.some((entry) => entry.id === message.id) ? current : [...current, message]);
      setText("");
      await refreshConversations();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ส่งข้อความไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-neutral-950">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="text-2xl font-black">Borow Borow<span className="text-[#c9a227]">.</span></Link>
          <div className="flex items-center gap-2"><ActivityNavLinks /><Link href="/dashboard" className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-black text-white">Dashboard</Link></div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:py-8">
        <aside className="overflow-hidden rounded-3xl border border-neutral-200 bg-white">
          <div className="border-b p-5"><p className="text-xs font-black tracking-[0.22em] text-[#9d7d13]">MESSAGES</p><h1 className="mt-1 text-xl font-black">แชตการยืม</h1></div>
          <div className="max-h-[72vh] overflow-y-auto p-2">
            {loading && <p className="p-4 text-sm text-neutral-500">กำลังโหลดแชต...</p>}
            {!loading && conversations.length === 0 && <p className="p-5 text-sm leading-6 text-neutral-500">ยังไม่มีห้องสนทนา ห้องจะถูกสร้างจากคำขอยืมของคุณโดยอัตโนมัติ</p>}
            {conversations.map((conversation) => (
              <button key={conversation.id} type="button" onClick={() => setSelectedId(conversation.id)} className={`mb-1 w-full rounded-2xl p-4 text-left transition ${selectedId === conversation.id ? "bg-[#faf5df] ring-1 ring-[#e3d28f]" : "hover:bg-neutral-50"}`}>
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-black">{conversation.counterpart.displayName}</p><p className="mt-1 truncate text-xs text-neutral-500">{conversation.item.title} · {conversation.rentalStatus}</p></div>{conversation.unreadCount > 0 && <span className="rounded-full bg-[#c9a227] px-2 py-1 text-[10px] font-black text-white">{conversation.unreadCount}</span>}</div>
                <p className="mt-2 truncate text-sm text-neutral-500">{conversation.lastMessage?.body || "เริ่มคุยเรื่องการรับ-ส่งของได้เลย"}</p>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-[640px] flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
          {!selected ? (
            <div className="grid flex-1 place-items-center p-10 text-center text-neutral-500"><div><p className="text-5xl">💬</p><p className="mt-4 font-bold">เลือกห้องสนทนาเพื่อเริ่มคุย</p></div></div>
          ) : (
            <>
              <div className="border-b px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black">{selected.counterpart.displayName}</h2><p className="mt-1 text-sm text-neutral-500">{selected.item.title} · Rental {selected.rentalRequestId.slice(0, 8)} · {selected.rentalStatus}</p></div><Link href={`/rent/${selected.item.id}`} className="rounded-xl border px-3 py-2 text-xs font-bold">ดูสินค้า</Link></div>
              </div>

              <div className="flex-1 overflow-y-auto bg-[#fcfcfb] p-4 sm:p-6">
                {hasMore && <div className="mb-5 text-center"><button type="button" onClick={() => void loadOlder()} className="rounded-full border bg-white px-4 py-2 text-xs font-bold">โหลดข้อความเก่ากว่า</button></div>}
                <div className="space-y-3">
                  {messages.map((message) => {
                    const mine = message.sender.id === currentUserId;
                    return <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 sm:max-w-[70%] ${mine ? "rounded-br-md bg-neutral-950 text-white" : "rounded-bl-md border bg-white"}`}><p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p><p className={`mt-1 text-[11px] ${mine ? "text-neutral-400" : "text-neutral-400"}`}>{timeOnly.format(new Date(message.createdAt))}{mine && message.readByOtherAt ? " · อ่านแล้ว" : ""}</p></div></div>;
                  })}
                  {messages.length === 0 && <p className="py-16 text-center text-sm text-neutral-400">ยังไม่มีข้อความ เริ่มนัดรายละเอียดการรับ-ส่งได้เลย</p>}
                  <div ref={bottomRef} />
                </div>
              </div>

              <div className="border-t bg-white p-4 sm:p-5">
                {error && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
                {CLOSED.has(selected.rentalStatus) ? (
                  <div className="rounded-xl bg-neutral-100 p-4 text-center text-sm text-neutral-500">รายการนี้จบหรือถูกยกเลิกแล้ว ประวัติแชตยังเปิดอ่านได้ แต่ไม่รับข้อความใหม่</div>
                ) : (
                  <form onSubmit={send} className="flex gap-3"><input value={text} onChange={(event) => setText(event.target.value)} maxLength={2000} placeholder="พิมพ์ข้อความ..." className="min-w-0 flex-1 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 outline-none focus:border-[#c9a227] focus:ring-2 focus:ring-[#c9a227]/20" /><button type="submit" disabled={sending || !text.trim()} className="rounded-2xl bg-[#c9a227] px-5 py-3 font-black text-white disabled:opacity-40">{sending ? "..." : "ส่ง"}</button></form>
                )}
                <p className="mt-2 px-1 text-[11px] text-neutral-400">อัปเดตใกล้เคียง realtime ทุก 4 วินาทีเมื่อเปิดแท็บ · ข้อความเก็บใน PostgreSQL</p>
              </div>
            </>
          )}
        </section>
      </div>
      <span className="sr-only">{selected?.lastMessage ? dateTime.format(new Date(selected.lastMessage.createdAt)) : ""}</span>
    </main>
  );
}
