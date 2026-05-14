import { useTranslations } from "next-intl";

export type OfficeHudProps = {
  workingCount: number;
  idleCount: number;
  errorCount: number;
  spendToday: number;
  budgetDaily?: number;
  onErrorFilter?: () => void;
};

function spendStyle(spendToday: number, budgetDaily: number): React.CSSProperties {
  const ratio = budgetDaily > 0 ? spendToday / budgetDaily : 0;
  if (ratio >= 1) {
    return {
      background: "color-mix(in srgb, var(--error) 15%, transparent)",
      borderColor: "color-mix(in srgb, var(--error) 40%, transparent)",
    };
  }
  if (ratio >= 0.8) {
    return {
      background: "color-mix(in srgb, var(--queued) 15%, transparent)",
      borderColor: "color-mix(in srgb, var(--queued) 40%, transparent)",
    };
  }
  return {};
}

export function OfficeHud({
  workingCount,
  idleCount,
  errorCount,
  spendToday,
  budgetDaily,
  onErrorFilter,
}: OfficeHudProps) {
  const t = useTranslations();

  const errorCard = (
    <>
      <span
        aria-hidden
        style={{ width: 8, height: 8, borderRadius: 50, background: "var(--error)", display: "inline-block" }}
      />{" "}
      <b>{errorCount}</b> {t("office.needs_attention_label")}
    </>
  );

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
        onErrorFilter ? (
          <button
            type="button"
            className="hud-card"
            onClick={onErrorFilter}
            title="Show agents needing attention"
            style={{ cursor: "pointer" }}
          >
            {errorCard}
          </button>
        ) : (
          <div className="hud-card">{errorCard}</div>
        )
      ) : null}
      <div style={{ flex: 1 }} />
      {budgetDaily ? (
        <div className="hud-card">
          {t("office.budget_daily")} <b>${budgetDaily.toFixed(2)}/day</b>
        </div>
      ) : null}
    </div>
  );
}
