import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[var(--ink)] text-white hover:bg-black",
        gold: "bg-[var(--gold)] text-[var(--ink)] hover:bg-[var(--gold-stronger)]",
        outline: "border border-[var(--line-strong)] bg-white text-[var(--ink)] hover:bg-[var(--surface-2)]",
        ghost: "text-[var(--ink)] hover:bg-[var(--surface-2)]",
        destructive: "bg-red-600 text-white hover:bg-red-700",
      },
      size: {
        default: "min-h-11 px-4",
        sm: "min-h-9 rounded-lg px-3 text-xs",
        lg: "min-h-12 px-5",
        icon: "h-11 w-11 min-h-11 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { Button, buttonVariants };
