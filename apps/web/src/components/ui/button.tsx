import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "default" | "primary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  /** When true, sets `aria-busy` and disables the button while keeping its width. */
  loading?: boolean;
};

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  default: "",
  primary: "primary",
  ghost: "ghost",
  danger: "danger",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "sm",
  md: "",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "default",
    size = "md",
    leftIcon,
    rightIcon,
    loading = false,
    disabled,
    className,
    type = "button",
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn("btn", VARIANT_CLASS[variant], SIZE_CLASS[size], className)}
      {...rest}
    >
      {leftIcon ? <span className="btn-icon" aria-hidden>{leftIcon}</span> : null}
      {children}
      {rightIcon ? <span className="btn-icon" aria-hidden>{rightIcon}</span> : null}
    </button>
  );
});
