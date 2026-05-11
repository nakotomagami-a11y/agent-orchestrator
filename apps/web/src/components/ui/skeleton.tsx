import { cn } from "@/lib/cn";

export type SkeletonProps = {
  width?: number | string;
  height?: number | string;
  rounded?: number | string;
  className?: string;
  /** Mark as decorative — caller should add a `role="status"` wrapper if needed. */
  ariaHidden?: boolean;
};

export function Skeleton({ width = "100%", height = 16, rounded = 6, className, ariaHidden = true }: SkeletonProps) {
  return (
    <span
      aria-hidden={ariaHidden}
      className={cn("ao-skeleton", className)}
      style={{
        display: "inline-block",
        width,
        height,
        borderRadius: rounded,
        background:
          "linear-gradient(90deg, var(--bg-2) 0%, var(--bg-3) 50%, var(--bg-2) 100%)",
        backgroundSize: "200% 100%",
        animation: "ao-skel-pulse 1.4s ease-in-out infinite",
      }}
    />
  );
}
