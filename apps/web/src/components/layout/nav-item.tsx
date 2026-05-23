"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

export type NavItemProps = {
  href: string;
  icon: IconName;
  label: ReactNode;
  badge?: ReactNode;
  active?: boolean;
};

export function NavItem({ href, icon, label, badge, active = false }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-[10px] h-[34px] px-[10px] rounded-[var(--r-sm)] text-[13px] text-txt-2 cursor-pointer border-none bg-transparent font-[inherit] text-left no-underline max-[1024px]:justify-center max-[1024px]:p-0 max-[1024px]:h-[44px]",
        active
          ? "bg-acc text-[var(--acc-ink)] shadow-[0_1px_0_rgba(0,0,0,0.06),0_2px_6px_rgba(233,84,32,0.30)]"
          : "hover:bg-bg-3"
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon name={icon} />
      <span className="max-[1024px]:hidden">{label}</span>
      {badge !== undefined && badge !== null ? (
        <span className={cn(
          "ml-auto font-[var(--font-mono)] text-[10.5px] py-[2px] px-[6px] bg-bg-3 text-txt-2 rounded-[999px]",
          active && "bg-[rgba(255,255,255,0.20)] text-white"
        )}>
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
