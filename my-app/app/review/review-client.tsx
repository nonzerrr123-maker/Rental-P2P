"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import SiteHeader from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-field";
import { StarIcon, CheckIcon } from "@/components/ui/icons";
import { Textarea } from "@/components/ui/textarea";
import { reviewFormSchema, type ReviewFormInput } from "@/lib/forms/rental-actions";
import type { ReviewContext, ReviewSummary } from "@/lib/rental/reviews";

export default function ReviewClient({ initialContext }: { initialContext: ReviewContext }) {
  const [review, setReview] = useState<ReviewSummary | null>(initialContext.existingReview);
  const [error, setError] = useState("");
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<ReviewFormInput>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: { rating: initialContext.existingReview?.rating ?? 0, comment: initialContext.existingReview?.comment ?? "" },
  });
  const rating = watch("rating");
  const submit = handleSubmit(async (values) => {
    setError("");
    try {
      const response = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rentalRequestId: initialContext.rentalRequestId, ...values }) });
      const payload = await response.json() as { ok?: boolean; review?: ReviewSummary; message?: string };
      if (!response.ok || !payload.ok || !payload.review) throw new Error(payload.message || "ส่งรีวิวไม่สำเร็จ");
      setReview(payload.review);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ"); }
  });

  return <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]"><SiteHeader/><div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12"><Link href={`/rental/${initialContext.rentalRequestId}`} className="text-sm font-black text-[var(--muted-strong)]">กลับ Rental</Link><section className="mt-4 rounded-[28px] border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-8"><p className="bb-label">Review</p><h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">ให้คะแนนหลังการยืม</h1><p className="mt-2 text-sm text-[var(--muted)]">{initialContext.itemTitle} · รีวิวให้ {initialContext.reviewee.displayName}</p>{review?<div className="mt-7 rounded-2xl border border-[var(--gold-line)] bg-[var(--gold-soft)] p-5"><div className="flex items-center gap-2 text-[var(--gold-strong)]"><CheckIcon size={18}/><p className="font-black">ส่งรีวิวแล้ว</p></div><div className="mt-4 flex gap-1">{[1,2,3,4,5].map((n)=><StarIcon key={n} size={24} className={n<=review.rating?"fill-[var(--gold)] text-[var(--gold)]":"text-[var(--line-strong)]"}/>)}</div>{review.comment&&<p className="mt-4 text-sm leading-6 text-[var(--muted-strong)]">{review.comment}</p>}</div>:!initialContext.canReview?<div className="mt-7 rounded-2xl bg-amber-50 p-5 text-sm font-bold text-amber-800">{initialContext.blockedReason}</div>:<form onSubmit={submit} className="mt-7" noValidate><p className="text-sm font-black">ประสบการณ์โดยรวม</p><div className="mt-3 flex gap-2">{[1,2,3,4,5].map((n)=><button key={n} type="button" aria-label={`${n} ดาว`} onClick={()=>setValue("rating",n,{shouldValidate:true})} className="grid h-11 w-11 place-items-center rounded-xl hover:bg-[var(--surface-2)]"><StarIcon size={27} className={n<=rating?"fill-[var(--gold)] text-[var(--gold)]":"text-[var(--line-strong)]"}/></button>)}</div><FormMessage>{errors.rating?.message}</FormMessage><Textarea {...register("comment")} maxLength={1500} placeholder="เล่าประสบการณ์ของคุณ (ไม่บังคับ)" className="mt-5 min-h-32"/><FormMessage>{errors.comment?.message}</FormMessage>{error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}<Button type="submit" disabled={isSubmitting} className="mt-5 min-h-12 w-full">{isSubmitting?"กำลังส่ง...":"ส่งรีวิว"}</Button></form>}</section></div></main>;
}
