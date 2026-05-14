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
    <div role="status" className="empty-state">
      {icon ? (
        <div aria-hidden className="empty-state-icon">
          <Icon name={icon} size={22} />
        </div>
      ) : null}
      <div className="empty-state-title">{title}</div>
      {description ? <div className="empty-state-desc">{description}</div> : null}
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  );
}
