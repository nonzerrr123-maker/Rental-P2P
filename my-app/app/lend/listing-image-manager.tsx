"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type RentalImage = {
  id: string;
  itemId: string;
  altText: string | null;
  sortOrder: number;
  createdAt: string;
  contentUrl: string;
};

async function loadImages(itemId: string): Promise<RentalImage[]> {
  const response = await fetch(`/api/rental-items/${itemId}/images`, { cache: "no-store" });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.message ?? "โหลดรูปไม่สำเร็จ");
  return result.images;
}

export default function ListingImageManager({
  itemId,
  refreshKey,
}: {
  itemId: string;
  refreshKey: number;
}) {
  const [images, setImages] = useState<RentalImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    void loadImages(itemId)
      .then((nextImages) => {
        if (active) {
          setImages(nextImages);
          setMessage("");
        }
      })
      .catch((error: unknown) => {
        if (active) setMessage(error instanceof Error ? error.message : "โหลดรูปไม่สำเร็จ");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [itemId, refreshKey]);

  const remove = async (imageId: string) => {
    if (busyId) return;
    setBusyId(imageId);
    setMessage("");
    try {
      const response = await fetch(`/api/rental-items/${itemId}/images/${imageId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "ลบรูปไม่สำเร็จ");
      setImages(await loadImages(itemId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ลบรูปไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= images.length || busyId) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    setImages(next);
    setBusyId(images[index].id);
    setMessage("");
    try {
      const response = await fetch(`/api/rental-items/${itemId}/images`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedImageIds: next.map((image) => image.id) }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message ?? "จัดลำดับรูปไม่สำเร็จ");
      setImages(result.images);
    } catch (error) {
      setImages(await loadImages(itemId));
      setMessage(error instanceof Error ? error.message : "จัดลำดับรูปไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-black">รูปของประกาศล่าสุด</h3>
          <p className="mt-1 text-xs text-gray-500">รูปแรกคือรูปหน้าปก ลากลำดับด้วยปุ่มลูกศรหรือลบรูปที่ไม่ต้องการได้</p>
        </div>
        <span className="rounded-full bg-black px-3 py-1 text-xs font-bold text-white">{images.length}/8</span>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-gray-500">กำลังโหลดรูป...</p>
      ) : images.length === 0 ? (
        <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-500">ประกาศนี้ยังไม่มีรูป</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((image, index) => (
            <article key={image.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="relative aspect-square bg-gray-100">
                <Image
                  src={image.contentUrl}
                  alt={image.altText ?? `รูปที่ ${index + 1}`}
                  fill
                  sizes="(max-width: 640px) 50vw, 180px"
                  className="object-cover"
                  unoptimized
                />
                {index === 0 ? (
                  <span className="absolute left-2 top-2 rounded-full bg-[#D4AF37] px-2 py-1 text-[10px] font-black text-black">หน้าปก</span>
                ) : null}
              </div>
              <div className="grid grid-cols-3 gap-1 p-2">
                <button type="button" disabled={index === 0 || Boolean(busyId)} onClick={() => void move(index, -1)} className="rounded-lg border px-2 py-1 text-xs disabled:opacity-30" aria-label="เลื่อนรูปไปทางซ้าย">←</button>
                <button type="button" disabled={index === images.length - 1 || Boolean(busyId)} onClick={() => void move(index, 1)} className="rounded-lg border px-2 py-1 text-xs disabled:opacity-30" aria-label="เลื่อนรูปไปทางขวา">→</button>
                <button type="button" disabled={Boolean(busyId)} onClick={() => void remove(image.id)} className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 disabled:opacity-30" aria-label="ลบรูป">ลบ</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {message ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{message}</p> : null}
    </section>
  );
}
