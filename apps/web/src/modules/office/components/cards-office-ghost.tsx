"use client";

import { Skeleton } from "@/components/ui/skeleton";

export type CardsOfficeGhostProps = {
  count?: number;
};

export function CardsOfficeGhost({ count = 6 }: CardsOfficeGhostProps) {
  return (
    <ul
      className="overflow-auto flex flex-wrap content-start p-[64px_18px_18px] gap-[14px] list-none m-0 [&>*]:[flex:1_1_220px]"
      aria-busy="true"
      aria-label="Loading agents"
      role="status"
    >
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <div className="bg-bg-1 border border-line cursor-pointer flex flex-col gap-[10px] rounded-lg p-[14px] transition-all duration-[120ms] w-full pointer-events-none">
            <div className="flex items-center gap-[10px]">
              <div className="w-[40px] h-[40px] shrink-0">
                <Skeleton width={40} height={40} rounded={20} />
              </div>
              <div className="min-w-0 flex-1 flex flex-col gap-[5px]">
                <Skeleton width={120} height={13} />
                <Skeleton width={80} height={11} />
              </div>
              <Skeleton width={8} height={8} rounded={99} />
            </div>

            <div className="text-txt-2 bg-bg-2 overflow-hidden text-[12px] p-[8px_10px] rounded-[8px] font-[var(--font-mono)] border-l-2 border-acc min-h-[42px] line-clamp-2">
              <Skeleton width="70%" height={12} />
            </div>

            <div className="flex justify-between items-center text-txt-3 text-[11px] font-[var(--font-mono)]">
              <Skeleton width={90} height={11} />
              <Skeleton width={60} height={11} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
