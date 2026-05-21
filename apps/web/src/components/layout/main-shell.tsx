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
    <div className={cn("grid min-h-0 [grid-template-columns:248px_minmax(0,1fr)] max-[1024px]:[grid-template-columns:64px_minmax(0,1fr)] max-[600px]:[grid-template-columns:minmax(0,1fr)]", className)}>
      <Sidebar />
      <main className="flex flex-col min-h-0 [min-width:0]">
        <ScrollReset />
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
