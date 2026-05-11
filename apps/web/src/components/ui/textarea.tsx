import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, rows = 4, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(className)}
      style={{
        width: "100%",
        padding: "8px 10px",
        background: "var(--bg-1)",
        border: `1px solid ${invalid ? "var(--error)" : "var(--line-2)"}`,
        borderRadius: "var(--r-md)",
        color: "var(--txt)",
        font: "inherit",
        fontSize: 13,
        lineHeight: 1.5,
        outline: "none",
        resize: "vertical",
        boxShadow: "var(--shadow-1)",
      }}
      {...rest}
    />
  );
});
