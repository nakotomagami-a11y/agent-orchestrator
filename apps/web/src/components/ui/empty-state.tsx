import type { ReactNode } from "react";
import { Icon, type IconName } from "./icon";

export type EmptyStateProps = {
  icon?: IconName;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      role="status"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "48px 24px",
        textAlign: "center",
        color: "var(--txt-2)",
      }}
    >
      {icon ? (
        <div
          aria-hidden
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: "var(--bg-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--txt-3)",
          }}
        >
          <Icon name={icon} size={22} />
        </div>
      ) : null}
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--txt)" }}>{title}</div>
      {description ? <div style={{ fontSize: 12.5, maxWidth: 360 }}>{description}</div> : null}
      {action ? <div style={{ marginTop: 4 }}>{action}</div> : null}
    </div>
  );
}
