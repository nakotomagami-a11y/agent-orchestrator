import type { ReactNode } from "react";
import { GnomeWindow } from "@/components/layout/gnome-window";
import { Titlebar } from "@/components/layout/titlebar";
import { MainShell } from "@/components/layout/main-shell";
import { AgentDetailsModal } from "@/modules/office/components/agent-details-modal";

/**
 * Group layout for in-app pages (everything except auth, if/when added).
 * Wraps every protected page in the GNOME window chrome + sidebar, plus
 * global overlays (agent-details modal) so a sidebar click works on any
 * route.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <GnomeWindow titlebar={<Titlebar />}>
      <MainShell>{children}</MainShell>
      <AgentDetailsModal />
    </GnomeWindow>
  );
}
