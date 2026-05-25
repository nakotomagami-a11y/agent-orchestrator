"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

type ActionKey = "office" | "memory" | "all" | "clear";
type UIState = "idle" | "loading" | "done" | "error";

async function callSeed(action: ActionKey): Promise<void> {
  const res = await fetch("/api/dev/seed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  if (!res.ok) {
    const body = await res.json() as { error?: string };
    throw new Error(body.error ?? "seed failed");
  }
}

function FlaskIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6M9 3v7L5 20h14L15 10V3M9 3h6" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

interface ActionButtonProps {
  label: string;
  action: ActionKey;
  variant?: "default" | "accent" | "danger";
  state: UIState;
  onAction: (action: ActionKey) => void;
}

function ActionButton({ label, action, variant = "default", state, onAction }: ActionButtonProps) {
  const isLoading = state === "loading";
  const isDone = state === "done";

  const base = "w-full flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-mono transition-colors";
  const variants = {
    default: "bg-bg-2 text-txt-2 hover:text-txt hover:bg-bg-3 border border-line hover:border-line-2",
    accent: "bg-acc text-acc-ink hover:opacity-90 border border-acc",
    danger: "bg-transparent text-red-400 hover:text-red-300 hover:bg-red-900/20 border border-red-900/40 hover:border-red-900/60",
  };

  return (
    <button
      type="button"
      onClick={() => onAction(action)}
      disabled={isLoading}
      className={`${base} ${variants[variant]} ${isLoading ? "opacity-50 cursor-wait" : ""}`}
    >
      {isLoading ? (
        <>
          <Spinner />
          <span>working…</span>
        </>
      ) : isDone ? (
        <span className="text-green-400">✓ done</span>
      ) : (
        label
      )}
    </button>
  );
}

export function DevMenu() {
  const [open, setOpen] = useState(false);
  const [states, setStates] = useState<Record<ActionKey, UIState>>({
    office: "idle",
    memory: "idle",
    all: "idle",
    clear: "idle",
  });
  const queryClient = useQueryClient();

  async function handleAction(action: ActionKey) {
    setStates(s => ({ ...s, [action]: "loading" }));
    try {
      await callSeed(action);
      setStates(s => ({ ...s, [action]: "done" }));
      await queryClient.invalidateQueries();
      setTimeout(() => {
        setStates(s => ({ ...s, [action]: "idle" }));
      }, 2000);
    } catch {
      setStates(s => ({ ...s, [action]: "idle" }));
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Dev tools"
        className="h-[24px] px-[10px] inline-flex items-center gap-[6px] bg-transparent border border-transparent rounded-sm text-txt-2 font-[inherit] text-[12.5px] cursor-pointer hover:bg-bg-2 hover:border-line"
      >
        <FlaskIcon />
        Dev
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 z-[500] w-64 bg-bg-1 border border-line rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-line">
            <span className="font-mono text-[10px] uppercase tracking-widest text-txt-4">Dev Tools</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-txt-4 hover:text-txt text-xs leading-none transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="p-3 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-mono text-txt-4 uppercase tracking-wider">Office floor</span>
              <ActionButton label="Seed project + runs" action="office" state={states.office} onAction={handleAction} />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-mono text-txt-4 uppercase tracking-wider">Memory pages</span>
              <ActionButton label="Seed agent memories" action="memory" state={states.memory} onAction={handleAction} />
            </div>

            <div className="flex flex-col gap-1.5">
              <ActionButton label="Seed everything" action="all" variant="accent" state={states.all} onAction={handleAction} />
            </div>

            <div className="border-t border-line pt-3">
              <ActionButton label="Clear demo data" action="clear" variant="danger" state={states.clear} onAction={handleAction} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
