"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { useThemeHydration, useThemeStore } from "@/lib/theme-store";
import {
  closeWindow,
  isTauri,
  minimizeWindow,
  toggleMaximizeWindow,
} from "@/lib/tauri-window";
import { ProjectSwitcher } from "./project-switcher";

/**
 * The in-app titlebar plays two roles depending on where the app runs:
 *
 *   - Browser tab: pure decoration. The three win-dots are static, the
 *     bar isn't draggable, the OS provides its own window chrome.
 *   - Tauri desktop window (decorations: false): the win-dots are the
 *     real close / minimise / maximise controls, and the bar is a
 *     `data-tauri-drag-region` so the user can drag the window by it.
 *
 * We probe `__TAURI_INTERNALS__` at click-time rather than render-time
 * so SSR and hydration don't diverge.
 */
export function Titlebar() {
  const t = useTranslations();
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  useThemeHydration();

  const dotBg = { close: "bg-[#E95420]", min: "bg-[#FFC107]", max: "bg-[#4CAF50]" } as const;

  const dotProps = (kind: "close" | "min" | "max") => ({
    className: `${dotBg[kind]} w-[14px] h-[14px] rounded-full inline-flex items-center justify-center text-[9px] leading-none cursor-pointer border border-[rgba(0,0,0,0.08)] [color:rgba(0,0,0,0.5)]`,
    role: "button" as const,
    tabIndex: 0,
    "aria-label": t(`titlebar.win_${kind}`),
    // The titlebar itself is a `data-tauri-drag-region`; marking the
    // dots as `false` opts them out, so clicks fire onClick instead
    // of starting a window drag.
    "data-tauri-drag-region": "false" as const,
    onClick: () => {
      if (!isTauri()) return;
      if (kind === "close") void closeWindow();
      else if (kind === "min") void minimizeWindow();
      else void toggleMaximizeWindow();
    },
  });

  // Only the centre title strip is the drag handle. The left and right
  // sections are full of interactive controls (project switcher,
  // theme toggle, the win-dot buttons) and shouldn't trigger window
  // dragging - leaving those wrappers without the attribute is the
  // simplest way to opt them out wholesale.
  return (
    <div className="grid items-center px-3 border-b border-line select-none [grid-template-columns:1fr_auto_1fr] bg-[linear-gradient(180deg,var(--bg-2),var(--bg-1))] dark:bg-[linear-gradient(180deg,#3a322c,#2A2522)]">
      <div className="flex items-center gap-2">
        <div className="flex gap-2">
          <span {...dotProps("close")} />
          <span {...dotProps("min")} />
          <span {...dotProps("max")} />
        </div>
        <ProjectSwitcher />
      </div>
      <div className="font-semibold text-[13px] text-txt-2 flex items-center gap-2 max-[600px]:hidden" data-tauri-drag-region>
        <span
          aria-hidden
          className="inline-block w-4 h-4 rounded-[4px] bg-[linear-gradient(135deg,var(--yaru-orange),var(--yaru-purple))]"
        />
        {t("app.name")} - {t("app.studio_subtitle")}
      </div>
      <div className="flex items-center gap-2 justify-end">
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
  );
}
