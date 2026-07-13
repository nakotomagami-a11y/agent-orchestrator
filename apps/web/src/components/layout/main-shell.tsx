import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Sidebar } from "./sidebar";
import { ScrollReset } from "./scroll-reset";
import { PageTransition } from "./page-transition";

export type MainShellProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Body of the GNOME window: sidebar on the left + main column on the right.
 * Owns the per-route scroll reset + fade transition so individual pages don't
 * have to.
 */
export function MainShell({ children, className }: MainShellProps) {
  return (
    <div className={cn("flex min-h-0 flex-nowrap", className)}>
      <div className="shrink-0 w-[248px] max-[1024px]:w-[64px] max-[600px]:hidden">
        <Sidebar />
      </div>
      <main className="flex-1 min-w-0 flex flex-col min-h-0">
        <ScrollReset />
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
