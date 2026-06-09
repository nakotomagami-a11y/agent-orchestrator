"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { useAddInstance } from "@/modules/projects/hooks/use-projects";
import { useOfficeStore } from "./use-office-store";
import type { AgentInstance } from "@agent-office/shared/types";

export function useSpawnInstance(params: {
  activeProjectId: string | null;
}): {
  spawnInstance: (agentId: string) => Promise<void>;
} {
  const { activeProjectId } = params;
  const t = useTranslations();
  const addMut = useAddInstance();
  const setGroupExpanded = useOfficeStore((s) => s.setGroupExpanded);

  const spawnInstance = useCallback(async (agentId: string) => {
    if (!activeProjectId) return;
    try {
      await new Promise<{ instance: AgentInstance }>((resolve, reject) => {
        addMut.mutate(
          { projectId: activeProjectId, agentId },
          {
            onSuccess: (data) => resolve(data),
            onError: reject,
          },
        );
      });
      setGroupExpanded(activeProjectId, agentId, true);
    } catch (err: unknown) {
      const anyErr = err as { status?: number; data?: { softCap?: boolean } };
      if (anyErr?.status === 409) {
        if (anyErr?.data?.softCap) {
          const ok = window.confirm(t("sidebar.instance_cap_soft"));
          if (!ok) return;
          try {
            await new Promise<{ instance: AgentInstance }>((resolve, reject) => {
              addMut.mutate(
                { projectId: activeProjectId, agentId, force: true },
                { onSuccess: (data) => resolve(data), onError: reject },
              );
            });
            setGroupExpanded(activeProjectId, agentId, true);
          } catch {
            // silently fail — backend hard-stopped it
          }
        } else {
          window.alert(t("sidebar.instance_cap_hard"));
        }
      }
    }
  }, [activeProjectId, addMut, setGroupExpanded, t]);

  return { spawnInstance };
}
