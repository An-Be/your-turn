import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Mobile-first page column. Header and footer go inside it. */
export function Shell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto flex min-h-dvh w-full max-w-md flex-col px-4", className)}>{children}</div>;
}
