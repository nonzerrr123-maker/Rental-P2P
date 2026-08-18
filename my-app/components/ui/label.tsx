import * as React from "react";
import { cn } from "@/lib/utils";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-sm font-bold leading-none text-[var(--ink)]", className)} {...props} />;
}

export { Label };
