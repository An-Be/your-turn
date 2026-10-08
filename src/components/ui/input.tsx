import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-14 w-full border border-ink bg-paper px-4 font-display text-[22px] font-medium tracking-[-0.02em] placeholder:text-faint focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-[-3px]",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
