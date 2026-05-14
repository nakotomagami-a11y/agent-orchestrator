// Lucide-style icons for the agent modal. Stroke 1.6, rounded.
import type { SVGProps } from "react";

type IconProps = { size?: number } & Omit<SVGProps<SVGSVGElement>, "width" | "height">;

const Icon = ({ gfx, size = 16, ...rest }: IconProps & { gfx: React.ReactNode }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    {...rest}
  >
    {gfx}
  </svg>
);

export const AoClose = (p: IconProps) => <Icon {...p} gfx={<><path d="M18 6L6 18" /><path d="M6 6l12 12" /></>} />;
export const AoSearch = (p: IconProps) => <Icon {...p} gfx={<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>} />;
export const AoFilter = (p: IconProps) => <Icon {...p} gfx={<path d="M3 4h18l-7 9v6l-4 2v-8z" />} />;
export const AoDown = (p: IconProps) => <Icon {...p} gfx={<path d="M6 9l6 6 6-6" />} />;
export const AoUp = (p: IconProps) => <Icon {...p} gfx={<path d="M6 15l6-6 6 6" />} />;
export const AoPlus = (p: IconProps) => <Icon {...p} gfx={<><path d="M12 5v14" /><path d="M5 12h14" /></>} />;
export const AoPen = (p: IconProps) => <Icon {...p} gfx={<><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z" /></>} />;
export const AoTrash = (p: IconProps) => <Icon {...p} gfx={<><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></>} />;
export const AoSend = (p: IconProps) => <Icon {...p} gfx={<path d="M22 2L11 13" />} />;
export const AoPaperclip = (p: IconProps) => <Icon {...p} gfx={<path d="M21 12l-9 9a5 5 0 0 1-7-7l9-9a3.5 3.5 0 1 1 5 5L9.5 19.5a2 2 0 0 1-3-3l8.5-8.5" />} />;
export const AoBranch = (p: IconProps) => <Icon {...p} gfx={<><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><path d="M6 8.5v7" /><path d="M18 8.5c0 4-6 3-6 7" /></>} />;
export const AoArrowDown = (p: IconProps) => <Icon {...p} gfx={<><path d="M12 5v14" /><path d="M19 12l-7 7-7-7" /></>} />;
export const AoArrowUp = (p: IconProps) => <Icon {...p} gfx={<><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></>} />;
export const AoCornerDown = (p: IconProps) => <Icon {...p} gfx={<><path d="M9 10l-5 5 5 5" /><path d="M20 4v7a4 4 0 0 1-4 4H4" /></>} />;
export const AoSparkle = (p: IconProps) => <Icon {...p} gfx={<path d="M12 2l1.7 5.3L19 9l-5.3 1.7L12 16l-1.7-5.3L5 9l5.3-1.7z" />} />;
export const AoBot = (p: IconProps) => <Icon {...p} gfx={<><rect x="3" y="8" width="18" height="12" rx="2" /><path d="M12 8V4" /><circle cx="9" cy="14" r="1" /><circle cx="15" cy="14" r="1" /><path d="M8 4h8" /></>} />;
export const AoIdentity = (p: IconProps) => <Icon {...p} gfx={<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="11" r="2.5" /><path d="M14 9h4" /><path d="M14 13h3" /><path d="M5 17.5c.7-1.6 2.3-2.5 4-2.5s3.3.9 4 2.5" /></>} />;
export const AoCpu = (p: IconProps) => <Icon {...p} gfx={<><rect x="5" y="5" width="14" height="14" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" /></>} />;
export const AoShield = (p: IconProps) => <Icon {...p} gfx={<path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z" />} />;
export const AoWrench = (p: IconProps) => <Icon {...p} gfx={<path d="M14.7 6.3a4 4 0 1 1 3 3L6 21l-3-3 11.7-11.7" />} />;
export const AoSparkles = (p: IconProps) => <Icon {...p} gfx={<><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></>} />;
export const AoBook = (p: IconProps) => <Icon {...p} gfx={<><path d="M4 4h12a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z" /><path d="M4 17h12" /></>} />;
export const AoEye = (p: IconProps) => <Icon {...p} gfx={<><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></>} />;
export const AoCode = (p: IconProps) => <Icon {...p} gfx={<><path d="M16 18l6-6-6-6" /><path d="M8 6l-6 6 6 6" /></>} />;
export const AoLightning = (p: IconProps) => <Icon {...p} gfx={<path d="M13 2L4 14h6l-1 8 9-12h-6z" />} />;
export const AoCheck = (p: IconProps) => <Icon {...p} gfx={<path d="M20 6L9 17l-5-5" />} />;
export const AoFolder = (p: IconProps) => <Icon {...p} gfx={<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />} />;
export const AoTerminal = (p: IconProps) => <Icon {...p} gfx={<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9l3 3-3 3" /><path d="M13 15h4" /></>} />;
export const AoGlobe = (p: IconProps) => <Icon {...p} gfx={<><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" /></>} />;
export const AoList = (p: IconProps) => <Icon {...p} gfx={<><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>} />;
export const AoWildcard = (p: IconProps) => <Icon {...p} gfx={<><path d="M12 4v16" /><path d="M5 8l14 8" /><path d="M5 16l14-8" /></>} />;
export const AoBold = (p: IconProps) => <Icon {...p} gfx={<><path d="M7 5h6a3 3 0 0 1 0 6H7z" /><path d="M7 11h7a3 3 0 0 1 0 6H7z" /></>} />;
export const AoItalic = (p: IconProps) => <Icon {...p} gfx={<><path d="M19 4h-9" /><path d="M14 20H5" /><path d="M15 4L9 20" /></>} />;
export const AoHeading = (p: IconProps) => <Icon {...p} gfx={<><path d="M6 4v16" /><path d="M18 4v16" /><path d="M6 12h12" /></>} />;
export const AoLink = (p: IconProps) => <Icon {...p} gfx={<><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></>} />;
export const AoReset = (p: IconProps) => <Icon {...p} gfx={<><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></>} />;
export const AoChevronRight = (p: IconProps) => <Icon {...p} gfx={<path d="M9 6l6 6-6 6" />} />;
export const AoLock = (p: IconProps) => <Icon {...p} gfx={<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>} />;
export const AoQuestion = (p: IconProps) => <Icon {...p} gfx={<><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 1-1 1.7" /><circle cx="12" cy="17" r=".5" fill="currentColor" /></>} />;
