import { CheckIcon, ClockIcon, PackageIcon } from "@/components/ui/icons";

const steps = [
  { key: "PAID", label: "ชำระแล้ว" },
  { key: "WAITING_PICKUP", label: "รอรับของ" },
  { key: "RENTING", label: "กำลังยืม" },
  { key: "RETURNING", label: "กำลังคืน" },
  { key: "RETURNED", label: "คืนแล้ว" },
  { key: "COMPLETED", label: "เสร็จสิ้น" },
] as const;

const order: Record<string, number> = {
  REQUESTED: -3,
  ACCEPTED: -2,
  WAITING_PAYMENT: -1,
  PAID: 0,
  WAITING_PICKUP: 1,
  RENTING: 2,
  RETURNING: 3,
  RETURNED: 4,
  COMPLETED: 5,
};

export default function RentalLifecycleStepper({ status, compact = false }: { status: string; compact?: boolean }) {
  const current = order[status] ?? -1;
  const terminal = ["REJECTED", "CANCELLED", "EXPIRED", "DISPUTED"].includes(status);
  if (terminal) {
    return <div className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-bold text-[var(--muted-strong)]"><ClockIcon size={14}/>{status}</div>;
  }

  return (
    <ol className={`grid ${compact ? "grid-cols-6 gap-1" : "grid-cols-3 gap-3 sm:grid-cols-6"}`} aria-label="สถานะการยืม">
      {steps.map((step, index) => {
        const done = current > index;
        const active = current === index;
        return (
          <li key={step.key} className="min-w-0">
            <div className={`mx-auto grid ${compact ? "h-6 w-6" : "h-8 w-8"} place-items-center rounded-full border ${done ? "border-[var(--ink)] bg-[var(--ink)] text-white" : active ? "border-[var(--gold)] bg-[var(--gold-soft)] text-[var(--gold-strong)]" : "border-[var(--line-strong)] bg-white text-[var(--muted)]"}`}>
              {done ? <CheckIcon size={compact ? 13 : 15}/> : active ? <PackageIcon size={compact ? 12 : 14}/> : <span className="text-[9px] font-black">{index + 1}</span>}
            </div>
            {!compact && <p className={`mt-2 truncate text-center text-[10px] font-bold ${active || done ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}>{step.label}</p>}
          </li>
        );
      })}
    </ol>
  );
}
