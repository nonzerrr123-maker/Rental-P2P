import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

function FormField({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("space-y-2", className)} {...props} />;
}

function FormLabel(props: React.ComponentProps<typeof Label>) {
  return <Label {...props} />;
}

function FormDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-xs leading-5 text-[var(--muted)]", className)} {...props} />;
}

function FormMessage({ className, children, ...props }: React.ComponentProps<"p">) {
  if (!children) return null;
  return <p role="alert" className={cn("text-xs font-bold leading-5 text-red-700", className)} {...props}>{children}</p>;
}

export { FormField, FormLabel, FormDescription, FormMessage };
