import { useTranslations } from "next-intl";

export type OfficeHudProps = {
  workingCount: number;
  idleCount: number;
  errorCount: number;
  spendToday: number;
  budgetDaily?: number;
};

export function OfficeHud({ workingCount, idleCount, errorCount, spendToday, budgetDaily = 50 }: OfficeHudProps) {
  const t = useTranslations();
  return (
    <div className="office-hud">
      <div className="hud-card">
        <span
          aria-hidden
          style={{ width: 8, height: 8, borderRadius: 50, background: "var(--working)", display: "inline-block" }}
        />{" "}
        <b>{workingCount}</b> {t("office.live_label")}
      </div>
      <div className="hud-card">
        <span
          aria-hidden
          style={{ width: 8, height: 8, borderRadius: 50, background: "var(--idle)", display: "inline-block" }}
        />{" "}
        <b>{idleCount}</b> {t("office.idle_label")}
      </div>
      {errorCount > 0 ? (
        <div className="hud-card">
          <span
            aria-hidden
            style={{ width: 8, height: 8, borderRadius: 50, background: "var(--error)", display: "inline-block" }}
          />{" "}
          <b>{errorCount}</b> {t("office.needs_attention_label")}
        </div>
      ) : null}
      <div style={{ flex: 1 }} />
      <div className="hud-card">
        {t("office.spend_today")} <b className="accent">${spendToday.toFixed(2)}</b>
      </div>
      <div className="hud-card">
        {t("office.budget_daily")} <b>${budgetDaily.toFixed(2)}</b>
      </div>
    </div>
  );
}
