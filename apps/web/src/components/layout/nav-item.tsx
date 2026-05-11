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
    <Link href={href} className={cn("nav-item", active && "on")} aria-current={active ? "page" : undefined}>
      <Icon name={icon} />
      <span>{label}</span>
      {badge !== undefined && badge !== null ? <span className="badge">{badge}</span> : null}
    </Link>
  );
}
