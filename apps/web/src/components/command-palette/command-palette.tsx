"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type KeyboardEvent,
} from "react";
import { useFilter } from "@/hooks/use-filter";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { Icon, type IconName } from "@/components/ui/icon";
import { usePaletteStore } from "@/lib/palette-store";
import { useClaudeLimitsStore } from "@/lib/claude-limits-store";
import { useProcessesStore } from "@/lib/processes-store";
import { PAGE_ROUTES } from "@agent-office/shared/config/routes";

// ---------------------------------------------------------------------------
// Command registry
// ---------------------------------------------------------------------------

type Command = {
  id: string;
  label: string;
  secondary?: string;
  icon: IconName;
  action: (router: AppRouterInstance) => void;
};

const COMMANDS: Command[] = [
  {
    id: "nav-office",
    label: "Go to Office",
    icon: "home",
    action: (r) => r.push(PAGE_ROUTES.office),
  },
  {
    id: "nav-activity",
    label: "Go to Activity",
    icon: "activity",
    action: (r) => r.push(PAGE_ROUTES.activity),
  },
  {
    id: "nav-agents",
    label: "Go to Agents",
    icon: "templates",
    action: (r) => r.push(PAGE_ROUTES.agents),
  },
  {
    id: "nav-projects",
    label: "Go to Projects",
    icon: "folder",
    action: (r) => r.push(PAGE_ROUTES.projects),
  },
  {
    id: "nav-settings",
    label: "Go to Settings",
    icon: "settings",
    action: (r) => r.push(PAGE_ROUTES.settings),
  },
  {
    id: "nav-search",
    label: "Search Runs",
    secondary: "⌘K then type",
    icon: "search",
    action: (r) => r.push("/search"),
  },
  {
    id: "open-limits",
    label: "Open Limits",
    icon: "gauge",
    action: () => useClaudeLimitsStore.getState().setOpen(true),
  },
  {
    id: "open-servers",
    label: "Running Servers",
    icon: "server",
    action: () => useProcessesStore.getState().setOpen(true),
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPalette() {
  const open = usePaletteStore((s) => s.open);
  const setOpen = usePaletteStore((s) => s.setOpen);
  const router = useRouter();

  const { query, setQuery, filtered } = useFilter(
    COMMANDS,
    (c, q) => c.label.toLowerCase().includes(q.toLowerCase()),
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // SSR safety for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Global Cmd+K / Ctrl+K toggle
  useEffect(() => {
    const onGlobalKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onGlobalKey);
    return () => document.removeEventListener("keydown", onGlobalKey);
  }, [setOpen]);

  // Reset query + active index when palette opens; focus input
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // rAF so the element is visible before we focus
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Scroll active row into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector<HTMLElement>(
      "[data-active='true']",
    );
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const close = useCallback(() => setOpen(false), [setOpen]);

  const execute = useCallback(
    (cmd: Command) => {
      close();
      cmd.action(router);
    },
    [close, router],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (filtered.length === 0 ? 0 : (i + 1) % filtered.length));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) =>
        filtered.length === 0 ? 0 : (i - 1 + filtered.length) % filtered.length,
      );
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[activeIndex];
      if (cmd) execute(cmd);
      return;
    }
  };

  // Keep activeIndex in bounds when filter changes
  useEffect(() => {
    setActiveIndex((i) => (filtered.length === 0 ? 0 : Math.min(i, filtered.length - 1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  if (!mounted || !open) return null;

  return createPortal(
    // Backdrop
    <div
      role="presentation"
      onClick={close}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "15vh",
      }}
    >
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(580px, 92vw)",
          maxHeight: 480,
          background: "var(--bg-1)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--shadow-window)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Search input */}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={true}
          aria-autocomplete="list"
          aria-controls="cmd-palette-list"
          aria-activedescendant={
            filtered[activeIndex] ? `cmd-${filtered[activeIndex]!.id}` : undefined
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search commands…"
          style={{
            width: "100%",
            border: "none",
            borderBottom: "1px solid var(--line)",
            padding: "14px 16px",
            fontSize: 15,
            background: "transparent",
            color: "var(--txt)",
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        {/* Results */}
        <div
          id="cmd-palette-list"
          ref={listRef}
          role="listbox"
          aria-label="Commands"
          style={{
            overflowY: "auto",
            maxHeight: 360,
            padding: 6,
          }}
        >
          {filtered.length === 0 ? (
            <div
              style={{
                padding: "12px 10px",
                fontSize: 13,
                color: "var(--txt-3)",
                textAlign: "center",
              }}
            >
              No commands found
            </div>
          ) : (
            filtered.map((cmd, idx) => {
              const isActive = idx === activeIndex;
              return (
                <div
                  key={cmd.id}
                  id={`cmd-${cmd.id}`}
                  role="option"
                  aria-selected={isActive}
                  data-active={isActive}
                  onClick={() => execute(cmd)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: "var(--r-md)",
                    cursor: "pointer",
                    background: isActive ? "var(--bg-2)" : "transparent",
                    userSelect: "none",
                  }}
                >
                  <Icon name={cmd.icon} size={16} aria-hidden />
                  <span style={{ flex: 1, fontSize: 14, color: "var(--txt)" }}>
                    {cmd.label}
                  </span>
                  {cmd.secondary ? (
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        color: "var(--txt-3)",
                      }}
                    >
                      {cmd.secondary}
                    </span>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
