"use client";

import Link from "next/link";
import { useState } from "react";
import type { ReviewContext, ReviewSummary } from "@/lib/rental/reviews";

export default function ReviewClient({ initialContext }: { initialContext: ReviewContext }) {
  const [rating, setRating] = useState(initialContext.existingReview?.rating ?? 0);
  const [comment, setComment] = useState(initialContext.existingReview?.comment ?? "");
  const [review, setReview] = useState<ReviewSummary | null>(initialContext.existingReview);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rentalRequestId: initialContext.rentalRequestId, rating, comment }),
      });
      const payload = await response.json() as { ok?: boolean; review?: ReviewSummary; message?: string };
      if (!response.ok || !payload.ok || !payload.review) throw new Error(payload.message || "ส่งรีวิวไม่สำเร็จ");
      setReview(payload.review);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ"); }
    finally { setBusy(false); }
  };

  return <main className="min-h-screen bg-[#f7f7f5] text-neutral-950">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5"><Link href="/" className="text-2xl font-black">Borow Borow<span className="text-[#c9a227]">.</span></Link><Link href={`/rental/${initialContext.rentalRequestId}`} className="rounded-xl border px-4 py-2 text-sm font-bold">กลับ Rental</Link></div></header>
    <div className="mx-auto max-w-2xl px-6 py-12"><section className="rounded-3xl border bg-white p-8 shadow-sm"><p className="text-xs font-black tracking-[0.25em] text-[#9d7d13]">REVIEW</p><h1 className="mt-3 text-3xl font-black">ให้คะแนนหลังการยืม</h1><p className="mt-2 text-neutral-500">{initialContext.itemTitle} · รีวิวให้ {initialContext.reviewee.displayName}</p>
      {review ? <div className="mt-8 rounded-2xl bg-[#faf7ed] p-6 ring-1 ring-[#e7d9a8]"><p className="text-sm font-black">ส่งรีวิวแล้ว</p><p className="mt-3 text-3xl tracking-widest text-[#c9a227]">{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</p>{review.comment && <p className="mt-4 text-sm leading-6 text-neutral-600">{review.comment}</p>}<p className="mt-4 text-xs text-neutral-500">1 รีวิวต่อผู้ใช้ต่อ Rental · ระบบ derive ผู้รับรีวิวจากคู่สัญญาเอง</p></div> : !initialContext.canReview ? <div className="mt-8 rounded-2xl bg-amber-50 p-5 text-sm font-bold text-amber-800">{initialContext.blockedReason}</div> : <div className="mt-8"><p className="text-sm font-bold">ประสบการณ์โดยรวม</p><div className="mt-3 flex gap-2">{[1,2,3,4,5].map((n) => <button key={n} type="button" aria-label={`${n} ดาว`} onClick={() => setRating(n)} className={`text-4xl transition ${n <= rating ? "text-[#c9a227]" : "text-neutral-200"}`}>★</button>)}</div><textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1500} placeholder="เล่าประสบการณ์ของคุณ (ไม่บังคับ)" className="mt-6 min-h-32 w-full rounded-2xl border bg-neutral-50 p-4 outline-none focus:border-[#c9a227]" />{error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}<button type="button" disabled={!rating || busy} onClick={() => void submit()} className="mt-5 w-full rounded-2xl bg-neutral-950 px-5 py-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-30">{busy ? "กำลังส่ง..." : "ส่งรีวิว"}</button></div>}
    </section></div>
  </main>;
}
