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

  const dotProps = (kind: "close" | "min" | "max") => ({
    className: `win-dot ${kind}`,
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
  // dragging — leaving those wrappers without the attribute is the
  // simplest way to opt them out wholesale.
  return (
    <div className="titlebar">
      <div className="tb-left">
        <div className="win-controls">
          <span {...dotProps("close")} />
          <span {...dotProps("min")} />
          <span {...dotProps("max")} />
        </div>
        <ProjectSwitcher />
      </div>
      <div className="tb-title" data-tauri-drag-region>
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 16,
            height: 16,
            borderRadius: 4,
            background: "linear-gradient(135deg, var(--yaru-orange), var(--yaru-purple))",
          }}
        />
        {t("app.name")} — {t("app.studio_subtitle")}
      </div>
      <div className="tb-right">
        <button
          type="button"
          className="tb-btn"
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
