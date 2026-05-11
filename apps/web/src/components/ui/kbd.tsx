import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type KbdProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
};

export function Kbd({ children, className, ...rest }: KbdProps) {
  return (
    <kbd className={cn("kbd", className)} {...rest}>
      {children}
    </kbd>
  );
}
