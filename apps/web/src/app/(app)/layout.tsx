import type { ReactNode } from "react";
import { GnomeWindow } from "@/components/layout/gnome-window";
import { Titlebar } from "@/components/layout/titlebar";
import { MainShell } from "@/components/layout/main-shell";
import { AgentDetailsModal } from "@/modules/office/components/agent-details";
import { ClaudeLimitsModal } from "@/modules/limits/components/claude-limits-modal";
import { ProcessesModal } from "@/modules/processes/components/processes-modal";
import { FirstRunGate } from "@/modules/onboarding/components/first-run-gate";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { CompareModal } from "@/modules/runs/components/compare-modal";

/**
 * Group layout for in-app pages (everything except auth, if/when added).
 * Wraps every protected page in the GNOME window chrome + sidebar, plus
 * global overlays (agent-details + Claude limits modals) so any trigger
 * elsewhere in the app can open them.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <GnomeWindow titlebar={<Titlebar />}>
      <MainShell>{children}</MainShell>
      <AgentDetailsModal />
      <ClaudeLimitsModal />
      <ProcessesModal />
      <CommandPalette />
      <CompareModal />
      <FirstRunGate />
    </GnomeWindow>
  );
}
