"use client";

import { Skeleton } from "@/components/ui/skeleton";

export type CardsOfficeGhostProps = {
  count?: number;
};

export function CardsOfficeGhost({ count = 6 }: CardsOfficeGhostProps) {
  return (
    <ul
      className="cards-office list-none m-0"
      aria-busy="true"
      aria-label="Loading agents"
      role="status"
    >
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <div
            className="desk-card border border-line bg-bg-1 w-full pointer-events-none"
          >
            {/* dc-h: avatar circle + name/id + status dot placeholder */}
            <div className="dc-h">
              <div className="av shrink-0">
                <Skeleton width={40} height={40} rounded={20} />
              </div>
              <div className="min-w-0 flex-1 flex flex-col gap-[5px]">
                <Skeleton width={120} height={13} />
                <Skeleton width={80} height={11} />
              </div>
              {/* status dot ghost: a small circle matching StatusDot size */}
              <Skeleton width={8} height={8} rounded={99} />
            </div>

            {/* dc-task */}
            <div className="dc-task block">
              <Skeleton width="70%" height={12} />
            </div>

            {/* dc-meta */}
            <div className="dc-meta">
              <Skeleton width={90} height={11} />
              <Skeleton width={60} height={11} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
