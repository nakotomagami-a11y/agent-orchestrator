import type { SVGProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Icon registry. Mirrors the v3 `II.*` set in design-source/sprites.jsx,
 * collapsed into a single declarative component so callers say
 * <Icon name="home" /> instead of pulling individual symbols.
 *
 * Adding a new icon? Append a key to ICON_PATHS — the type updates itself.
 */

type IconShape = {
  /** viewBox override (defaults to "0 0 24 24") */
  viewBox?: string;
  /** stroke-only icons share these defaults; filled icons override via `fill` */
  fill?: "none" | "currentColor";
  stroke?: "none" | "currentColor";
  strokeWidth?: number;
  strokeLinecap?: "round" | "butt" | "square";
  strokeLinejoin?: "round" | "miter" | "bevel";
  /** raw inner JSX as a render fn so we don't ship dangerouslySetInnerHTML */
  body: React.ReactNode;
};

const STROKE_BASE: Omit<IconShape, "body"> = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const FILL_BASE: Omit<IconShape, "body"> = {
  fill: "currentColor",
  stroke: "none",
};

const ICON_PATHS = {
  home: {
    ...STROKE_BASE,
    body: (
      <>
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
      </>
    ),
  },
  users: {
    ...STROKE_BASE,
    body: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.9" />
        <path d="M16 3.1a4 4 0 0 1 0 7.8" />
      </>
    ),
  },
  activity: {
    ...STROKE_BASE,
    body: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  },
  settings: {
    ...STROKE_BASE,
    body: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </>
    ),
  },
  templates: {
    ...STROKE_BASE,
    body: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
  },
  memory: {
    ...STROKE_BASE,
    body: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M7 10v4M11 10v4M15 10v4" />
      </>
    ),
  },
  plus: {
    ...STROKE_BASE,
    strokeWidth: 2,
    strokeLinejoin: undefined,
    body: <path d="M12 5v14M5 12h14" />,
  },
  send: {
    ...FILL_BASE,
    body: <path d="M3 11.5 21 3l-8.5 18-2-7.5-7.5-2z" />,
  },
  attach: {
    ...STROKE_BASE,
    body: (
      <path d="m21 12-9 9a5.5 5.5 0 0 1-7.8-7.8l9-9a3.7 3.7 0 0 1 5.2 5.2l-9 9a1.8 1.8 0 0 1-2.6-2.6l8.5-8.5" />
    ),
  },
  image: {
    ...STROKE_BASE,
    body: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-5-5L5 21" />
      </>
    ),
  },
  slash: {
    ...STROKE_BASE,
    strokeLinejoin: undefined,
    body: <path d="m17 4-10 16" />,
  },
  copy: {
    ...STROKE_BASE,
    body: (
      <>
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </>
    ),
  },
  branch: {
    ...STROKE_BASE,
    body: (
      <>
        <circle cx="6" cy="6" r="2" />
        <circle cx="6" cy="18" r="2" />
        <circle cx="18" cy="8" r="2" />
        <path d="M6 8v8M8 6h5a5 5 0 0 1 5 5" />
      </>
    ),
  },
  refresh: {
    ...STROKE_BASE,
    body: (
      <>
        <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
        <path d="M21 3v5h-5" />
      </>
    ),
  },
  edit: {
    ...STROKE_BASE,
    body: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z" />
      </>
    ),
  },
  search: {
    ...STROKE_BASE,
    body: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    ),
  },
  gauge: {
    ...STROKE_BASE,
    body: (
      <>
        <path d="M3.5 17a9 9 0 1 1 17 0" />
        <path d="m12 12 4-2" />
        <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      </>
    ),
  },
  x: {
    ...STROKE_BASE,
    strokeWidth: 2,
    strokeLinejoin: undefined,
    body: <path d="M6 6l12 12M18 6 6 18" />,
  },
  chevron: {
    ...STROKE_BASE,
    body: <path d="m9 18 6-6-6-6" />,
  },
  "chevron-down": {
    ...STROKE_BASE,
    body: <path d="m6 9 6 6 6-6" />,
  },
  play: {
    ...FILL_BASE,
    body: <path d="M8 5v14l11-7z" />,
  },
  stop: {
    ...FILL_BASE,
    body: <rect x="6" y="6" width="12" height="12" rx="1" />,
  },
  map: {
    ...STROKE_BASE,
    body: (
      <>
        <path d="m9 4-7 3v13l7-3 6 3 7-3V4l-7 3z" />
        <path d="M9 4v13M15 7v13" />
      </>
    ),
  },
  grid: {
    ...STROKE_BASE,
    body: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </>
    ),
  },
  folder: {
    ...STROKE_BASE,
    body: (
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    ),
  },
  cpu: {
    ...STROKE_BASE,
    body: (
      <>
        <rect x="5" y="5" width="14" height="14" rx="2" />
        <rect x="9" y="9" width="6" height="6" />
        <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" />
      </>
    ),
  },
  sun: {
    ...STROKE_BASE,
    body: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </>
    ),
  },
  moon: {
    ...STROKE_BASE,
    body: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  },
} as const;

export type IconName = keyof typeof ICON_PATHS;

export type IconProps = Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: IconName;
  /** Pixel size; defaults to inheriting from the surrounding `.i` rule (16px). */
  size?: number;
  /** Optional accessible label — when omitted the icon is `aria-hidden`. */
  label?: string;
};

export function Icon({
  name,
  size,
  label,
  className,
  width,
  height,
  ...rest
}: IconProps) {
  const shape = ICON_PATHS[name];
  const ariaProps = label
    ? { role: "img" as const, "aria-label": label }
    : { "aria-hidden": true };
  const dimProps =
    size !== undefined
      ? { width: size, height: size }
      : { width: width ?? undefined, height: height ?? undefined };

  return (
    <svg
      viewBox={shape.viewBox ?? "0 0 24 24"}
      className={cn("i", className)}
      fill={shape.fill}
      stroke={shape.stroke}
      strokeWidth={shape.strokeWidth}
      strokeLinecap={shape.strokeLinecap}
      strokeLinejoin={shape.strokeLinejoin}
      {...dimProps}
      {...ariaProps}
      {...rest}
    >
      {shape.body}
    </svg>
  );
}
