"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/ui/icon";
import { useThemeHydration, useThemeStore } from "@/lib/theme-store";
import { ProjectSwitcher } from "./project-switcher";

export function Titlebar() {
  const t = useTranslations();
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  useThemeHydration();

  return (
    <div className="titlebar">
      <div className="tb-left">
        <div className="win-controls" aria-hidden>
          <span className="win-dot close" />
          <span className="win-dot min" />
          <span className="win-dot max" />
        </div>
        <ProjectSwitcher />
      </div>
      <div className="tb-title">
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
