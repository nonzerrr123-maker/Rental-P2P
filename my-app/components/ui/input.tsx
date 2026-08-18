import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex min-h-12 w-full rounded-xl border border-[var(--line-strong)] bg-white px-3.5 py-2 text-sm text-[var(--ink)] shadow-[var(--shadow-xs)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--gold)] focus:ring-4 focus:ring-[rgba(200,167,77,.12)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-400 aria-invalid:ring-red-100",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
