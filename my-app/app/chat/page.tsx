"use client";

import { useState } from "react";

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([{ from: "owner", text: "สวัสดีครับ สนใจยืม PS5 ช่วงไหนครับ?" }]);

  const send = () => {
    const value = message.trim();
    if (!value) return;
    setMessages((current) => [...current, { from: "me", text: value }]);
    setMessage("");
  };

  return <main className="min-h-screen bg-gray-50 text-black"><header className="border-b bg-black px-6 py-5 text-white"><div className="mx-auto flex max-w-4xl items-center justify-between"><a href="/" className="text-2xl font-black">P2P<span className="text-[#D4AF37]">.</span></a><span className="text-sm text-gray-400">Rental Chat</span></div></header><div className="mx-auto max-w-3xl px-4 py-8"><div className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b p-5"><p className="font-bold">Game House · PlayStation 5</p><p className="mt-1 text-xs text-gray-500">คำขอยืม #R000001 · 🟢 Verified</p></div><div className="min-h-[480px] space-y-4 bg-gray-50 p-5">{messages.map((item, index) => <div key={index} className={`flex ${item.from === "me" ? "justify-end" : "justify-start"}`}><div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${item.from === "me" ? "bg-black text-white" : "border bg-white"}`}>{item.text}</div></div>)}</div><div className="flex gap-2 border-t p-4"><input value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="พิมพ์ข้อความ..." className="flex-1 rounded-lg border px-4 py-3 outline-none focus:border-[#D4AF37]" /><button onClick={send} className="rounded-lg bg-[#D4AF37] px-5 font-bold">ส่ง</button></div></div><p className="mt-4 text-center text-xs text-gray-400">UI นี้เป็น foundation เท่านั้น ระบบจริงต้องตรวจสิทธิ์ผู้ใช้จาก rental request และใช้ realtime backend</p></div></main>;
}
