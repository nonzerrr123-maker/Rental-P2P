"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import SiteHeader from "@/components/site-header";
import { MessageIcon, PackageIcon, SendIcon } from "@/components/ui/icons";
import type { ChatMessage, ConversationSummary } from "@/lib/chat/service";

const timeOnly = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit" });
const CLOSED = new Set(["REJECTED", "CANCELLED", "EXPIRED", "COMPLETED"]);

export default function ChatClient({ currentUserId, requestedRentalId }: { currentUserId: string; requestedRentalId: string | null }) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const latestMessageIdRef = useRef("");
  const receiptTickRef = useRef(0);
  const selected = useMemo(() => conversations.find((conversation) => conversation.id === selectedId) ?? null, [conversations, selectedId]);
  const conversationUrl = requestedRentalId ? `/api/conversations?rentalRequestId=${encodeURIComponent(requestedRentalId)}` : "/api/conversations";

  const refreshConversations = async () => {
    const response = await fetch(conversationUrl, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || "โหลดรายการแชตไม่สำเร็จ");
    const next = payload.conversations as ConversationSummary[];
    setConversations(next);
    setSelectedId((current) => current || payload.selectedConversationId || next[0]?.id || "");
  };

  useEffect(() => { latestMessageIdRef.current = messages.at(-1)?.id ?? ""; }, [messages]);
  useEffect(() => {
    let active = true;
    fetch(conversationUrl, { cache: "no-store" }).then(async (response) => { const payload = await response.json(); if (!response.ok || !payload.ok) throw new Error(payload.message || "โหลดรายการแชตไม่สำเร็จ"); return payload; }).then((payload) => { if (!active) return; const next=payload.conversations as ConversationSummary[]; setConversations(next); setSelectedId((current)=>current||payload.selectedConversationId||next[0]?.id||""); setError(""); }).catch((cause:unknown)=>{if(active)setError(cause instanceof Error?cause.message:"โหลดแชตไม่สำเร็จ");}).finally(()=>{if(active)setLoading(false);});
    return () => { active = false; };
  }, [conversationUrl]);
  useEffect(() => {
    if (!selectedId) return;
    let active=true;
    fetch(`/api/conversations/${selectedId}/messages?limit=50`,{cache:"no-store"}).then(async(response)=>{const payload=await response.json();if(!response.ok||!payload.ok)throw new Error(payload.message||"โหลดข้อความไม่สำเร็จ");return payload;}).then((payload)=>{if(!active)return;setMessages(payload.items as ChatMessage[]);setHasMore(Boolean(payload.hasMore));setError("");return fetch(`/api/conversations/${selectedId}/read`,{method:"POST"});}).catch((cause:unknown)=>{if(active)setError(cause instanceof Error?cause.message:"โหลดข้อความไม่สำเร็จ");});
    return()=>{active=false;};
  },[selectedId]);
  useEffect(() => {
    if (!selectedId) return;
    let active=true;
    const poll=async()=>{if(document.hidden)return;try{const lastId=latestMessageIdRef.current;if(lastId){const response=await fetch(`/api/conversations/${selectedId}/messages?after=${encodeURIComponent(lastId)}&limit=100`,{cache:"no-store"});const payload=await response.json();if(response.ok&&payload.ok&&active&&payload.items.length){setMessages((current)=>{const known=new Set(current.map((message)=>message.id));return [...current,...(payload.items as ChatMessage[]).filter((message)=>!known.has(message.id))];});await fetch(`/api/conversations/${selectedId}/read`,{method:"POST"}).catch(()=>undefined);}}receiptTickRef.current+=1;if(receiptTickRef.current%3===0){const response=await fetch(`/api/conversations/${selectedId}/messages?limit=50`,{cache:"no-store"});const payload=await response.json();if(response.ok&&payload.ok&&active){const latest=payload.items as ChatMessage[];const latestById=new Map(latest.map((message)=>[message.id,message]));setMessages((current)=>current.map((message)=>latestById.get(message.id)??message));}}const conversationsResponse=await fetch(conversationUrl,{cache:"no-store"});const conversationsPayload=await conversationsResponse.json();if(conversationsResponse.ok&&conversationsPayload.ok&&active)setConversations(conversationsPayload.conversations as ConversationSummary[]);}catch{}};
    const interval=window.setInterval(()=>void poll(),4000);const onVisibility=()=>{if(!document.hidden)void poll();};document.addEventListener("visibilitychange",onVisibility);return()=>{active=false;window.clearInterval(interval);document.removeEventListener("visibilitychange",onVisibility);};
  },[conversationUrl,selectedId]);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth",block:"end"});},[selectedId,messages.length]);

  const loadOlder=async()=>{const firstId=messages[0]?.id;if(!selectedId||!firstId)return;try{const response=await fetch(`/api/conversations/${selectedId}/messages?before=${encodeURIComponent(firstId)}&limit=50`,{cache:"no-store"});const payload=await response.json();if(!response.ok||!payload.ok)throw new Error(payload.message||"โหลดข้อความเก่าไม่สำเร็จ");setMessages((current)=>[...(payload.items as ChatMessage[]),...current]);setHasMore(Boolean(payload.hasMore));}catch(cause){setError(cause instanceof Error?cause.message:"โหลดข้อความเก่าไม่สำเร็จ");}};
  const send=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const body=text.trim();if(!selectedId||!body||sending)return;setSending(true);setError("");try{const response=await fetch(`/api/conversations/${selectedId}/messages`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({body,senderId:"client-value-is-ignored"})});const payload=await response.json();if(!response.ok||!payload.ok)throw new Error(payload.message||"ส่งข้อความไม่สำเร็จ");const message=payload.message as ChatMessage;setMessages((current)=>current.some((entry)=>entry.id===message.id)?current:[...current,message]);setText("");await refreshConversations();}catch(cause){setError(cause instanceof Error?cause.message:"ส่งข้อความไม่สำเร็จ");}finally{setSending(false);}};

  return <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]"><SiteHeader/><div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
    <div className="mb-4"><p className="bb-label">Messages</p><h1 className="mt-1 text-2xl font-black tracking-[-0.035em]">แชตการยืม</h1></div>
    <div className="grid gap-3 lg:grid-cols-[310px_minmax(0,1fr)] lg:gap-4">
      <aside className="min-w-0 rounded-[22px] border border-[var(--line)] bg-white lg:overflow-hidden">
        <div className="hide-scrollbar flex gap-2 overflow-x-auto p-2 lg:block lg:max-h-[74vh] lg:overflow-y-auto">
          {loading&&<p className="p-4 text-sm text-[var(--muted)]">กำลังโหลด...</p>}
          {!loading&&conversations.length===0&&<div className="min-w-full p-5 text-center lg:text-left"><MessageIcon className="mx-auto text-[var(--muted)] lg:mx-0"/><p className="mt-3 text-sm leading-6 text-[var(--muted)]">ยังไม่มีห้องสนทนา ห้องจะถูกสร้างจาก Rental โดยอัตโนมัติ</p></div>}
          {conversations.map((conversation)=><button key={conversation.id} type="button" onClick={()=>setSelectedId(conversation.id)} className={`min-w-[210px] rounded-2xl p-3 text-left lg:mb-1 lg:w-full lg:min-w-0 ${selectedId===conversation.id?"bg-[var(--gold-soft)] ring-1 ring-[var(--gold-line)]":"hover:bg-[var(--surface-2)]"}`}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-black">{conversation.counterpart.displayName}</p><p className="mt-1 truncate text-[10px] text-[var(--muted)]">{conversation.item.title}</p></div>{conversation.unreadCount>0&&<span className="rounded-full bg-[var(--gold)] px-2 py-1 text-[9px] font-black">{conversation.unreadCount}</span>}</div><p className="mt-2 truncate text-xs text-[var(--muted)]">{conversation.lastMessage?.body||"เริ่มคุยรายละเอียดการรับของ"}</p></button>)}
        </div>
      </aside>

      <section className="flex min-h-[calc(100dvh-220px)] flex-col overflow-hidden rounded-[24px] border border-[var(--line)] bg-white shadow-[var(--shadow-xs)] sm:min-h-[640px] lg:min-h-[74vh]">
        {!selected?<div className="grid flex-1 place-items-center p-10 text-center"><MessageIcon size={32} className="mx-auto text-[var(--muted)]"/><p className="mt-4 text-sm font-bold text-[var(--muted)]">เลือกห้องสนทนาเพื่อเริ่มคุย</p></div>:<>
          <div className="border-b border-[var(--line)] px-4 py-3 sm:px-5"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-black">{selected.counterpart.displayName}</h2><p className="mt-1 truncate text-[10px] text-[var(--muted)]">{selected.item.title} · {selected.rentalStatus}</p></div><Link href={`/rent/${selected.item.id}`} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl border border-[var(--line)] px-3 text-xs font-black"><PackageIcon size={14}/>ดูของ</Link></div></div>
          <div className="flex-1 overflow-y-auto bg-[var(--surface)] p-3 sm:p-5">{hasMore&&<div className="mb-4 text-center"><button type="button" onClick={()=>void loadOlder()} className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-xs font-bold">โหลดข้อความเก่า</button></div>}<div className="space-y-2.5">{messages.map((message)=>{const mine=message.sender.id===currentUserId;return <div key={message.id} className={`flex ${mine?"justify-end":"justify-start"}`}><div className={`max-w-[84%] rounded-2xl px-3.5 py-2.5 sm:max-w-[70%] ${mine?"rounded-br-md bg-[var(--ink)] text-white":"rounded-bl-md border border-[var(--line)] bg-white"}`}><p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p><p className={`mt-1 text-[10px] ${mine?"text-white/50":"text-[var(--muted)]"}`}>{timeOnly.format(new Date(message.createdAt))}{mine&&message.readByOtherAt?" · อ่านแล้ว":""}</p></div></div>;})}{messages.length===0&&<p className="py-16 text-center text-xs text-[var(--muted)]">ยังไม่มีข้อความ เริ่มนัดรายละเอียดการรับ–ส่งได้เลย</p>}<div ref={bottomRef}/></div></div>
          <div className="border-t border-[var(--line)] bg-white p-3 sm:p-4">{error&&<p role="alert" className="mb-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</p>}{CLOSED.has(selected.rentalStatus)?<div className="rounded-xl bg-[var(--surface-2)] p-3 text-center text-xs text-[var(--muted)]">Rental นี้จบหรือยกเลิกแล้ว อ่านประวัติได้แต่ส่งข้อความใหม่ไม่ได้</div>:<form onSubmit={send} className="flex items-end gap-2"><textarea rows={1} value={text} onChange={(event)=>setText(event.target.value)} maxLength={2000} placeholder="พิมพ์ข้อความ..." aria-label="ข้อความ" className="bb-input min-h-11 flex-1 resize-none py-3 text-sm"/><button type="submit" disabled={sending||!text.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--ink)] text-white disabled:opacity-40" aria-label="ส่งข้อความ"><SendIcon size={18}/></button></form>}</div>
        </>}
      </section>
    </div>
  </div></main>;
}
