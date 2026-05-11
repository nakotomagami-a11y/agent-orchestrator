import type { ReactNode } from "react";

export type ThinkingCardProps = {
  children: ReactNode;
};

export function ThinkingCard({ children }: ThinkingCardProps) {
  return (
    <div className="thinking-card" role="status">
      <span className="dots" aria-hidden>
        <span />
        <span />
        <span />
      </span>
      <span>{children}</span>
    </div>
  );
}
