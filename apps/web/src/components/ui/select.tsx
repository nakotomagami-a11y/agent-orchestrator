import { forwardRef, type SelectHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(className)}
      style={{
        height: 32,
        padding: "0 28px 0 10px",
        background: "var(--bg-1)",
        border: "1px solid var(--line-2)",
        borderRadius: "var(--r-md)",
        color: "var(--txt)",
        font: "inherit",
        fontSize: 13,
        outline: "none",
        cursor: "pointer",
        boxShadow: "var(--shadow-1)",
        appearance: "none",
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238A8079' stroke-width='1.7'><path d='m6 9 6 6 6-6'/></svg>\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 8px center",
        backgroundSize: "16px",
      }}
      {...rest}
    >
      {children}
    </select>
  );
});
