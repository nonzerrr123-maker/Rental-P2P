"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";

type Offer = {
  id: string;
  lenderId: string;
  lender: { displayName: string; verified: boolean; ratingAverage: string; ratingCount: number };
  rentalItem: { id: string; title: string; hourlyRate: string | null; dailyRate: string | null; status: string } | null;
  pricingMode: "HOUR" | "DAY" | null;
  offeredRate: string | null;
  message: string | null;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | "EXPIRED";
  rentalRequestId: string | null;
};

type Mine = {
  id: string;
  title: string;
  status: string;
  hourlyRate: string | null;
  dailyRate: string | null;
  province: string;
};

const money = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 });

export default function CommunityActions({
  requestId,
  requestTitle,
  requestStatus,
  isRequester,
  canAct,
  currentUserId,
  initialOffers,
}: {
  requestId: string;
  requestTitle: string;
  requestStatus: string;
  isRequester: boolean;
  canAct: boolean;
  currentUserId: string | null;
  initialOffers: Offer[];
}) {
  const router = useRouter();
  const [offers, setOffers] = useState(initialOffers);
  const [mine, setMine] = useState<Mine[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [pricingMode, setPricingMode] = useState<"HOUR" | "DAY">("DAY");
  const [offeredRate, setOfferedRate] = useState("");
  const [offerMessage, setOfferMessage] = useState("");

  const ownOffer = useMemo(() => offers.find((offer) => offer.lenderId === currentUserId), [offers, currentUserId]);
  const selectedItem = mine.find((item) => item.id === selectedItemId);

  useEffect(() => {
    if (!canAct || isRequester || requestStatus !== "OPEN") return;
    let active = true;
    void fetch("/api/rental-items/mine", { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => {
        if (!active || !result.ok) return;
        setMine((result.items as Mine[]).filter((item) => item.status === "ACTIVE"));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [canAct, isRequester, requestStatus]);

  useEffect(() => {
    if (!ownOffer) return;
    setSelectedItemId(ownOffer.rentalItem?.id ?? "");
    setPricingMode(ownOffer.pricingMode ?? "DAY");
    setOfferedRate(ownOffer.offeredRate ?? "");
    setOfferMessage(ownOffer.message ?? "");
  }, [ownOffer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshOffers = async () => {
    const response = await fetch(`/api/community-requests/${requestId}/offers`, { cache: "no-store" });
    const result = await response.json();
    if (response.ok && result.ok) setOffers(result.offers);
  };

  const requestAction = async (action: "CANCEL" | "CLOSE") => {
    setBusy(action);
    setMessage("");
    try {
      const response = await fetch(`/api/community-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "อัปเดตคำขอไม่สำเร็จ");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "อัปเดตคำขอไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  };

  const offerAction = async (offerId: string, action: "ACCEPT" | "REJECT" | "WITHDRAW") => {
    setBusy(`${offerId}:${action}`);
    setMessage("");
    try {
      const response = await fetch(`/api/community-offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "อัปเดตข้อเสนอไม่สำเร็จ");
      await refreshOffers();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "อัปเดตข้อเสนอไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  };

  const submitOffer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy("OFFER");
    setMessage("");
    const payload = {
      rentalItemId: selectedItemId || null,
      pricingMode: selectedItemId ? pricingMode : null,
      offeredRate: selectedItemId ? offeredRate : null,
      message: offerMessage,
      ...(ownOffer ? { action: "UPDATE" } : {}),
    };
    try {
      const response = await fetch(
        ownOffer ? `/api/community-offers/${ownOffer.id}` : `/api/community-requests/${requestId}/offers`,
        {
          method: ownOffer ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = await response.json();
      if (!response.ok || !result.ok) {
        const detail = result.fieldErrors ? Object.values(result.fieldErrors)[0] : null;
        throw new Error((detail as string | null) ?? result.message ?? "ส่งข้อเสนอไม่สำเร็จ");
      }
      await refreshOffers();
      setMessage(ownOffer ? "อัปเดตข้อเสนอแล้ว" : "ส่งข้อเสนอแล้ว ผู้ขอจะได้รับการแจ้งเตือน");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ส่งข้อเสนอไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  };

  if (!canAct) {
    return (
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black">อยากเสนอของหรือจัดการคำขอนี้?</h2>
        <p className="mt-2 text-sm text-neutral-500">เข้าสู่ระบบและยืนยันตัวตนก่อนจึงจะโพสต์ข้อเสนอหรือจับคู่ Rental ได้</p>
        <Link href={`/login?next=${encodeURIComponent(`/community/${requestId}`)}`} className="mt-4 inline-block rounded-xl bg-neutral-950 px-5 py-3 text-sm font-black text-white">เข้าสู่ระบบ</Link>
      </section>
    );
  }

  if (isRequester) {
    return (
      <section className="rounded-3xl border bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-black tracking-[0.2em] text-[#9d7d13]">OFFERS</p><h2 className="mt-1 text-2xl font-black">ข้อเสนอที่ได้รับ</h2></div>
          {requestStatus === "OPEN" && (
            <div className="flex gap-2">
              <button type="button" disabled={Boolean(busy)} onClick={() => requestAction("CLOSE")} className="rounded-xl border px-3 py-2 text-xs font-bold">ปิดรับข้อเสนอ</button>
              <button type="button" disabled={Boolean(busy)} onClick={() => requestAction("CANCEL")} className="rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-600">ยกเลิกคำขอ</button>
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-4">
          {offers.length === 0 ? <p className="rounded-2xl bg-neutral-50 p-5 text-sm text-neutral-500">ยังไม่มีคนส่งข้อเสนอเข้ามา</p> : offers.map((offer) => (
            <article key={offer.id} className="rounded-2xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h3 className="font-black">{offer.lender.displayName} {offer.lender.verified ? "✓" : ""}</h3><p className="mt-1 text-xs text-neutral-500">สถานะ {offer.status}</p></div>
                {offer.offeredRate && <p className="text-lg font-black">฿{money.format(Number(offer.offeredRate))}<span className="text-xs font-normal text-neutral-500"> / {offer.pricingMode === "HOUR" ? "ชม." : "วัน"}</span></p>}
              </div>
              {offer.rentalItem ? <p className="mt-3 rounded-xl bg-neutral-50 p-3 text-sm"><b>{offer.rentalItem.title}</b> · {offer.rentalItem.status}</p> : <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">ข้อเสนอนี้ยังไม่ผูกกับรายการของจริง ต้องผูกก่อน Accept</p>}
              {offer.message && <p className="mt-3 text-sm leading-6 text-neutral-600">{offer.message}</p>}
              {offer.status === "PENDING" && requestStatus === "OPEN" && (
                <div className="mt-4 flex gap-2">
                  <button type="button" disabled={Boolean(busy) || !offer.rentalItem} onClick={() => offerAction(offer.id, "ACCEPT")} className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-black text-white disabled:opacity-40">Accept → สร้าง Rental</button>
                  <button type="button" disabled={Boolean(busy)} onClick={() => offerAction(offer.id, "REJECT")} className="rounded-xl border px-4 py-2 text-sm font-bold">ปฏิเสธ</button>
                </div>
              )}
              {offer.status === "ACCEPTED" && offer.rentalRequestId && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/checkout/${offer.rentalRequestId}`} className="rounded-xl bg-[#c9a227] px-4 py-2 text-sm font-black text-black">ไป Checkout</Link>
                  <Link href={`/chat?rentalRequestId=${offer.rentalRequestId}`} className="rounded-xl border px-4 py-2 text-sm font-bold">เปิดแชต</Link>
                </div>
              )}
            </article>
          ))}
        </div>
        {message && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">{message}</p>}
      </section>
    );
  }

  if (ownOffer?.status === "ACCEPTED") {
    return (
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <p className="text-xs font-black tracking-[0.2em] text-[#9d7d13]">MATCHED</p>
        <h2 className="mt-2 text-2xl font-black">ข้อเสนอของคุณถูกเลือกแล้ว 🎉</h2>
        <p className="mt-2 text-sm text-neutral-500">Rental ถูกสร้างและรอผู้ยืมชำระเงินตาม flow ปกติ</p>
        {ownOffer.rentalRequestId && <div className="mt-4 flex gap-2"><Link href={`/rental/${ownOffer.rentalRequestId}`} className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-black text-white">ดู Rental</Link><Link href={`/chat?rentalRequestId=${ownOffer.rentalRequestId}`} className="rounded-xl border px-4 py-2 text-sm font-bold">เปิดแชต</Link></div>}
      </section>
    );
  }

  if (requestStatus !== "OPEN") {
    return <section className="rounded-3xl border bg-white p-6 text-sm text-neutral-500 shadow-sm">คำขอนี้ปิดรับข้อเสนอแล้ว</section>;
  }

  return (
    <section className="rounded-3xl border bg-white p-5 shadow-sm md:p-6">
      <p className="text-xs font-black tracking-[0.2em] text-[#9d7d13]">{ownOffer ? "YOUR OFFER" : "MAKE AN OFFER"}</p>
      <h2 className="mt-2 text-2xl font-black">{ownOffer ? "อัปเดตข้อเสนอของคุณ" : `มี ${requestTitle} ให้ยืมไหม?`}</h2>
      <p className="mt-2 text-sm leading-6 text-neutral-500">ผูกกับประกาศ ACTIVE ของคุณเพื่อให้ requester Accept แล้วสร้าง Rental ได้ทันที หรือส่งข้อความคุยไว้ก่อนแล้วค่อยกลับมาผูกของ</p>

      <form onSubmit={submitOffer} className="mt-5 grid gap-4">
        <label className="text-sm font-bold">รายการของฉัน
          <select value={selectedItemId} onChange={(event) => { setSelectedItemId(event.target.value); setOfferedRate(""); }} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal">
            <option value="">ยังไม่ผูกของ — ส่งข้อเสนอเพื่อคุยก่อน</option>
            {mine.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.province}</option>)}
          </select>
        </label>
        {selectedItemId && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold">คิดราคาแบบ
              <select value={pricingMode} onChange={(event) => setPricingMode(event.target.value as "HOUR" | "DAY")} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal">
                {selectedItem?.hourlyRate && <option value="HOUR">รายชั่วโมง</option>}
                {selectedItem?.dailyRate && <option value="DAY">รายวัน</option>}
              </select>
            </label>
            <label className="text-sm font-bold">ราคาที่เสนอ / หน่วย
              <input value={offeredRate} onChange={(event) => setOfferedRate(event.target.value)} type="number" min="0.01" max="10000000" step="0.01" placeholder={pricingMode === "HOUR" ? selectedItem?.hourlyRate ?? "100" : selectedItem?.dailyRate ?? "500"} className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" />
            </label>
          </div>
        )}
        <label className="text-sm font-bold">ข้อความถึงผู้ขอ
          <textarea value={offerMessage} onChange={(event) => setOfferMessage(event.target.value)} rows={4} maxLength={1500} placeholder="บอกสภาพของ จุดรับที่สะดวก หรือรายละเอียดที่ควรรู้" className="mt-2 w-full rounded-xl border px-4 py-3 font-normal" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={Boolean(busy)} className="rounded-xl bg-neutral-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{busy === "OFFER" ? "กำลังบันทึก..." : ownOffer ? "อัปเดตข้อเสนอ" : "ส่งข้อเสนอ"}</button>
          {ownOffer?.status === "PENDING" && <button type="button" disabled={Boolean(busy)} onClick={() => offerAction(ownOffer.id, "WITHDRAW")} className="rounded-xl border border-red-200 px-5 py-3 text-sm font-bold text-red-600">ถอนข้อเสนอ</button>}
        </div>
      </form>
      {message && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">{message}</p>}
    </section>
  );
}
