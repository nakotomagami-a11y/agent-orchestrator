import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Render with a label-like inset visual. */
  invalid?: boolean;
};

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { className, type = "text", invalid, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(className)}
      style={{
        width: "100%",
        height: 32,
        padding: "0 10px",
        background: "var(--bg-1)",
        border: `1px solid ${invalid ? "var(--error)" : "var(--line-2)"}`,
        borderRadius: "var(--r-md)",
        color: "var(--txt)",
        font: "inherit",
        fontSize: 13,
        outline: "none",
        boxShadow: "var(--shadow-1)",
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = "var(--acc)";
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = invalid ? "var(--error)" : "var(--line-2)";
        rest.onBlur?.(e);
      }}
      {...rest}
    />
  );
});
