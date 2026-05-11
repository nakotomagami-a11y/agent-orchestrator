import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TagVariant = "default" | "skill";

export type TagProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: TagVariant;
  children: ReactNode;
};

export function Tag({
  variant = "default",
  className,
  children,
  ...rest
}: TagProps) {
  return (
    <span
      className={cn("tag", variant === "skill" && "skill", className)}
      {...rest}
    >
      {children}
    </span>
  );
}
