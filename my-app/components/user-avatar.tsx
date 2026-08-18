"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  userId: string;
  displayName: string;
  version?: string | number | null;
  className?: string;
  imageClassName?: string;
};

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U"
  );
}

function AvatarPhoto({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="80px"
      unoptimized
      className={cn("object-cover", className)}
      onError={() => setVisible(false)}
    />
  );
}

export default function UserAvatar({
  userId,
  displayName,
  version = null,
  className,
  imageClassName,
}: UserAvatarProps) {
  const query = version === null || version === undefined ? "" : `?v=${encodeURIComponent(String(version))}`;
  const src = `/api/users/${userId}/avatar${query}`;

  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden bg-[var(--ink)] font-black tracking-tight text-[var(--gold)]",
        className,
      )}
      aria-label={`รูปโปรไฟล์ ${displayName}`}
    >
      <span aria-hidden="true">{initials(displayName)}</span>
      <AvatarPhoto key={src} src={src} alt={`รูปโปรไฟล์ ${displayName}`} className={imageClassName} />
    </span>
  );
}
