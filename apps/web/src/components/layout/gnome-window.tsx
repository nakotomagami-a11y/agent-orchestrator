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
      className={cn("gnome-window", maximized && "maximized", className)}
    >
      {titlebar}
      {children}
    </div>
  );
}
