import { create } from "zustand";

type BranchState = {
  agentId: string | null;
  instanceId: string | null;
  prompt: string | null;
  setSeed: (opts: { agentId: string; instanceId?: string | null; prompt: string }) => void;
  /** Returns the pending seed and clears it, but only if agentId matches. */
  consumeSeed: (agentId: string) => { prompt: string } | null;
};

export const useBranchStore = create<BranchState>((set, get) => ({
  agentId: null,
  instanceId: null,
  prompt: null,
  setSeed: ({ agentId, instanceId = null, prompt }) =>
    set({ agentId, instanceId, prompt }),
  consumeSeed: (agentId) => {
    const s = get();
    if (!s.prompt || s.agentId !== agentId) return null;
    set({ agentId: null, instanceId: null, prompt: null });
    return { prompt: s.prompt };
  },
}));
