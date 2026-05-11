// Avatars + Sparkline + inline icons (ported from design/avatars.jsx)
import type { Agent } from "./types";

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) * 16777619;
  }
  return h >>> 0;
}

export function colorFor(id: string, sat = 0.10, light = 0.62): string {
  const h = hashStr(id) % 360;
  return `oklch(${light} ${sat} ${h})`;
}

interface PixelProps { id: string; size?: number; }
export function PixelSprite({ id, size = 36 }: PixelProps) {
  const h = hashStr(id);
  const skin   = ["#f6c8a3", "#e3a684", "#c98c63", "#7e5238"][h % 4];
  const hair   = ["#2b2330", "#3b2f2a", "#7e3f2e", "#c98a3e", "#a3a8b8", "#48342a"][(h >> 3) % 6];
  const shirt  = colorFor(id + "shirt", 0.13, 0.58);
  const pants  = "#2b2f3a";
  const PX = size / 12;
  const px = (x: number, y: number, c: string) => (
    <rect key={x + "," + y} x={x * PX} y={y * PX} width={PX} height={PX} fill={c} />
  );
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges">
      {[3, 4, 5, 6, 7, 8].map(x => px(x, 11, "#1c1f25"))}
      {px(2, 10, "#1c1f25")}{px(9, 10, "#1c1f25")}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(x => px(x, 1, "#3a2f25"))}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(x => px(x, 2, "#503e2e"))}
      {[4, 5, 6, 7].map(x => px(x, 0, "#1c1f25"))}
      {[5, 6].map(x => px(x, 4, hair))}
      {[4, 5, 6, 7].map(x => px(x, 5, hair))}
      {[4, 7].map(x => px(x, 6, skin))}
      {[5, 6].map(x => px(x, 6, skin))}
      {[3, 4, 5, 6, 7, 8].map(x => px(x, 7, shirt))}
      {[3, 8].map(x => px(x, 8, shirt))}
      {[4, 5, 6, 7].map(x => px(x, 8, shirt))}
      {px(2, 4, skin)}{px(9, 4, skin)}
      {px(2, 5, shirt)}{px(9, 5, shirt)}
      {px(3, 3, skin)}{px(8, 3, skin)}
      {[4, 5, 6, 7].map(x => px(x, 3, "#23272e"))}
      {[3, 4, 5, 6, 7, 8].map(x => px(x, 9, pants))}
      {[3, 4, 5, 6, 7, 8].map(x => px(x, 10, pants))}
    </svg>
  );
}

export function Identicon({ id, size = 36 }: PixelProps) {
  const h = hashStr(id);
  const c = colorFor(id, 0.13, 0.62);
  const cells: [number, number][] = [];
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      const bit = (h >> (y * 3 + x)) & 1;
      if (bit) {
        cells.push([x, y]);
        if (x < 2) cells.push([4 - x, y]);
      }
    }
  }
  const PX = size / 6;
  const off = PX / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="transparent" />
      {cells.map(([x, y], i) => (
        <rect key={i} x={x * PX + off} y={y * PX + off} width={PX} height={PX} fill={c} rx={1} />
      ))}
    </svg>
  );
}

export function Glyph({ id, glyph, size = 36 }: { id: string; glyph?: string; size?: number }) {
  const c = colorFor(id, 0.13, 0.66);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect x="1" y="1" width={size - 2} height={size - 2} rx="6"
        fill={`color-mix(in oklch, ${c} 16%, transparent)`}
        stroke={`color-mix(in oklch, ${c} 50%, transparent)`} strokeWidth="1" />
      <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle"
        fill={c} fontSize={size * 0.48} fontFamily="Geist Mono, ui-monospace">
        {glyph || "◯"}
      </text>
    </svg>
  );
}

export function Monogram({ id, name, size = 36 }: { id: string; name: string; size?: number }) {
  const c = colorFor(id, 0.10, 0.46);
  const initials = (name || "??")
    .split(/\s+|-/)
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect width={size} height={size} rx="6" fill={c} />
      <text x="50%" y="56%" textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize={size * 0.42} fontWeight="600"
        fontFamily="Geist, ui-sans-serif">
        {initials}
      </text>
    </svg>
  );
}

export type AvatarStyle = "sprite" | "identicon" | "glyph" | "monogram";

export function Avatar({ agent, style = "sprite", size = 36 }: { agent: Pick<Agent, "id" | "name" | "glyph">; style?: AvatarStyle; size?: number }) {
  const id = agent.id;
  if (style === "sprite") return <PixelSprite id={id} size={size} />;
  if (style === "identicon") return <Identicon id={id} size={size} />;
  if (style === "glyph") return <Glyph id={id} glyph={agent.glyph} size={size} />;
  return <Monogram id={id} name={agent.name} size={size} />;
}

export function Sparkline({ data, w = 36, h = 14 }: { data: number[]; w?: number; h?: number }) {
  if (!data || !data.length) return null;
  const max = Math.max(...data, 0.01);
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [i * step, h - (v / max) * (h - 2) - 1] as [number, number]);
  const d = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const fill = d + ` L${w},${h} L0,${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="spark">
      <path d={fill} fill="currentColor" opacity="0.18" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

type IconProps = React.SVGProps<SVGSVGElement>;

export const I = {
  Search: (p: IconProps) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>,
  Plus: (p: IconProps) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14" /></svg>,
  Settings: (p: IconProps) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>,
  Activity: (p: IconProps) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>,
  List: (p: IconProps) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 6h18M3 12h18M3 18h18" /></svg>,
  Grid: (p: IconProps) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>,
  Floor: (p: IconProps) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="18" height="18" rx="1" /><path d="M3 12h18M12 3v18" /></svg>,
  Play: (p: IconProps) => <svg viewBox="0 0 24 24" className="i" fill="currentColor" stroke="none" {...p}><path d="M8 5v14l11-7z" /></svg>,
  Stop: (p: IconProps) => <svg viewBox="0 0 24 24" className="i" fill="currentColor" stroke="none" {...p}><rect x="6" y="6" width="12" height="12" rx="1" /></svg>,
  Copy: (p: IconProps) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>,
  Trash: (p: IconProps) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>,
  Check: (p: IconProps) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m5 12 5 5L20 7" /></svg>,
  X: (p: IconProps) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>,
  Chevron: (p: IconProps) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m9 18 6-6-6-6" /></svg>,
  Wrench: (p: IconProps) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14.7 6.3a4 4 0 0 0 5 5l-9.4 9.4a2 2 0 1 1-2.8-2.8z" /></svg>,
  Sparkles: (p: IconProps) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3" /></svg>,
  Folder: (p: IconProps) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>,
  Coffee: (p: IconProps) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 9h14v7a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" /><path d="M17 12h2a3 3 0 0 1 0 6h-2" /><path d="M6 4v2M10 4v2M14 4v2" /></svg>,
  Brain: (p: IconProps) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9.5 2A2.5 2.5 0 0 0 7 4.5v.5a3 3 0 0 0-3 3v0a3 3 0 0 0 0 6v0a3 3 0 0 0 3 3v0a2.5 2.5 0 0 0 5 0V4.5A2.5 2.5 0 0 0 9.5 2Z" /><path d="M14.5 2A2.5 2.5 0 0 1 17 4.5v.5a3 3 0 0 1 3 3v0a3 3 0 0 1 0 6v0a3 3 0 0 1-3 3v0a2.5 2.5 0 0 1-5 0V4.5A2.5 2.5 0 0 1 14.5 2Z" /></svg>,
  Paperclip: (p: IconProps) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49L12.95 2.56a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83L15 6.5" /></svg>,
};
