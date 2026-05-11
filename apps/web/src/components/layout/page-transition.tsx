"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Cross-fade route content. CSS keyed on the pathname — the browser handles
 * the animation, so no extra render pass per navigation.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div
      key={pathname}
      className="page-transition"
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </div>
  );
}
