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
    <div className={cn("win-body", className)}>
      <Sidebar />
      <main className="main">
        <ScrollReset />
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
