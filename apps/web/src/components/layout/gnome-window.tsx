"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { isTauri } from "@/lib/tauri-window";

export type GnomeWindowProps = {
  titlebar: ReactNode;
  children: ReactNode;
  className?: string;
};

function useIsMaximized(): boolean {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;

    async function init() {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      setMaximized(await win.isMaximized());
      unlisten = await win.onResized(async () => {
        setMaximized(await win.isMaximized());
      });
    }

    void init();
    return () => { unlisten?.(); };
  }, []);

  return maximized;
}

export function GnomeWindow({ titlebar, children, className }: GnomeWindowProps) {
  const maximized = useIsMaximized();

  return (
    <div
      className={cn("absolute bg-bg-1 shadow-[var(--shadow-window)] overflow-hidden grid border border-line-2 [grid-template-rows:38px_1fr] inset-[18px] rounded-[10px] max-[600px]:inset-0 max-[600px]:rounded-none", maximized && "inset-0 rounded-none shadow-none border-none", className)}
    >
      {titlebar}
      {children}
    </div>
  );
}
