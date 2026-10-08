import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-mono uppercase tracking-[0.14em] transition-colors disabled:pointer-events-none disabled:opacity-40 select-none",
  {
    variants: {
      variant: {
        primary: "bg-ink text-paper border border-ink hover:bg-mute hover:border-mute active:bg-ink",
        outline: "bg-paper text-ink border border-ink hover:bg-wash active:bg-ink active:text-paper",
        ghost: "bg-transparent text-mute hover:text-ink underline-offset-4 hover:underline",
      },
      size: {
        lg: "h-14 px-6 text-[13px]",
        md: "h-11 px-4 text-[12px]",
        sm: "h-8 px-2 text-[11px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";
