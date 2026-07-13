"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { useThemeHydration, useThemeStore } from "@/lib/theme-store";
import { usePerformanceHydration } from "@/lib/performance-store";
import { useIsMaximized } from "@/lib/use-is-maximized";
import {
  closeWindow,
  isTauri,
  minimizeWindow,
  toggleMaximizeWindow,
} from "@/lib/tauri-window";
import { ProjectSwitcher } from "./project-switcher";
import { RefreshButton } from "./refresh-button";
import { DevMenu } from "@/components/dev/dev-menu";
import { SkillUpdatesBell } from "./skill-updates-bell";

/**
 * The in-app titlebar plays two roles depending on where the app runs:
 *
 *   - Browser tab: full-width at top of viewport (no chrome inset).
 *   - Tauri desktop window (non-maximized): inset 18px on each side,
 *     rounded top corners - sits as the top of the framed window.
 *   - Tauri maximized: full-width, no rounding.
 *
 * The titlebar renders as a `fixed` overlay (NOT inside the GnomeWindow)
 * at z-[50] — deliberately *below* every portal-rendered modal so the
 * ProjectSwitcher chip + window controls get dimmed by the modal backdrop
 * instead of punching through on top of it. The user must close the
 * modal to reach the traffic-light controls, which matches standard
 * modal UX.
 *
 * The component also writes the current chrome inset (0 or 18px) to a
 * CSS custom property `--chrome-inset` on the document root. Other chrome-
 * aware components (the modal shell uses this to leave an 8px gap below
 * the titlebar) read it via `var(--chrome-inset)`.
 */
export function Titlebar() {
  const t = useTranslations();
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  useThemeHydration();
  usePerformanceHydration();
  const maximized = useIsMaximized();

  // Sync the current chrome inset (the gap around GnomeWindow + Titlebar)
  // into a CSS variable. Browser mode = 0 (no inset, see globals.css override).
  // Tauri non-maximized = 18. Tauri maximized = 0.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const inset = isTauri() && !maximized ? 18 : 0;
    document.documentElement.style.setProperty("--chrome-inset", `${inset}px`);
  }, [maximized]);

  const dotBg = { close: "bg-[#FF5F57]", min: "bg-[#FFBD2E]", max: "bg-[#28C840]" } as const;

  const dotProps = (kind: "close" | "min" | "max") => ({
    className: `${dotBg[kind]} w-[14px] h-[14px] rounded-full inline-flex items-center justify-center text-[9px] leading-none cursor-pointer border border-[rgba(0,0,0,0.08)] [color:rgba(0,0,0,0.5)]`,
    role: "button" as const,
    tabIndex: 0,
    "aria-label": t(`titlebar.win_${kind}`),
    "data-tauri-drag-region": "false" as const,
    onClick: () => {
      if (!isTauri()) return;
      if (kind === "close") void closeWindow();
      else if (kind === "min") void minimizeWindow();
      else void toggleMaximizeWindow();
    },
  });

  return (
    <div
      className={cn(
        // `app-titlebar` is the hook globals.css uses to flatten this in
        // browser mode (top/left/right -> 0, no rounding, no side borders).
        "app-titlebar fixed top-[18px] left-[18px] right-[18px] h-[38px] z-[50] border border-line-2 rounded-t-[10px]",
        maximized && "top-0 left-0 right-0 rounded-none border-l-0 border-r-0 border-t-0",
      )}
    >
      <div className="flex items-center h-full px-3 select-none bg-bg-2 border-b border-line rounded-t-[10px]">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isTauri() && (
            <div className="flex gap-2">
              <span {...dotProps("close")} />
              <span {...dotProps("min")} />
              <span {...dotProps("max")} />
            </div>
          )}
          <ProjectSwitcher />
        </div>
        <div className="font-semibold text-[13px] text-txt-2 flex items-center gap-2 shrink-0 max-[600px]:hidden" data-tauri-drag-region>
          <span
            aria-hidden
            className="inline-block w-4 h-4 rounded-[4px] bg-[linear-gradient(135deg,#5c4bb8,#7c6af5)]"
          />
          {t("app.name")} - {t("app.studio_subtitle")}
        </div>
        <div className="flex items-center gap-2 justify-end flex-1 min-w-0">
          <SkillUpdatesBell />
          <DevMenu />
          <RefreshButton />
          <button
            type="button"
            className="h-[24px] px-[10px] inline-flex items-center gap-[6px] bg-transparent border border-transparent rounded-sm text-txt-2 font-[inherit] text-[12.5px] cursor-pointer hover:bg-bg-2 hover:border-line"
            onClick={toggle}
            aria-label={theme === "dark" ? t("titlebar.switch_to_light") : t("titlebar.switch_to_dark")}
          >
            <Icon name={theme === "dark" ? "moon" : "sun"} size={13} />
            {theme === "dark" ? t("titlebar.theme_dark") : t("titlebar.theme_light")}
          </button>
        </div>
      </div>
    </div>
  );
}
