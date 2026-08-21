import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRightIcon, PackageIcon } from "@/components/ui/icons";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 font-black tracking-[-0.04em] text-[var(--ink)]">
      <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[var(--ink)] text-[13px] tracking-[-0.08em] text-[var(--gold)]">BB</span>
      {!compact && (
        <span className="text-xl sm:text-[22px]">
          <span>Borow</span>{" "}<span className="text-[var(--gold-strong)]">Borow</span>
        </span>
      )}
    </span>
  );
}

export function SectionEyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--gold-strong)]">{children}</p>;
}

export function SectionHeading({ eyebrow, title, description, actionHref, actionLabel }: {
  eyebrow?: string;
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <SectionEyebrow>{eyebrow}</SectionEyebrow>}
        <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-[var(--ink)] sm:text-3xl">{title}</h2>
        {description && <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)] sm:text-[15px]">{description}</p>}
      </div>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="inline-flex items-center gap-2 self-start text-sm font-black text-[var(--ink)] hover:text-[var(--gold-strong)]">
          {actionLabel}<ArrowRightIcon size={16}/>
        </Link>
      )}
    </div>
  );
}

export function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "gold" | "success" | "danger" }) {
  const classes = {
    neutral: "border-[var(--line)] bg-white text-[var(--muted-strong)]",
    gold: "border-[var(--gold-line)] bg-[var(--gold-soft)] text-[var(--gold-strong)]",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    danger: "border-red-200 bg-red-50 text-red-700",
  }[tone];
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${classes}`}>{children}</span>;
}

export function EmptyState({ title, description, actionHref, actionLabel }: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-[28px] border border-dashed border-[var(--line-strong)] bg-[var(--surface)] px-6 py-12 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-[var(--line)] bg-white text-[var(--muted)]"><PackageIcon/></div>
      <h3 className="mt-4 text-lg font-black tracking-tight">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{description}</p>
      {actionHref && actionLabel && <Link href={actionHref} className="mt-5 inline-flex rounded-xl bg-[var(--ink)] px-5 py-3 text-sm font-black text-white">{actionLabel}</Link>}
    </div>
  );
}

export function AppSurface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[24px] border border-[var(--line)] bg-white shadow-[var(--shadow-soft)] ${className}`}>{children}</div>;
}
