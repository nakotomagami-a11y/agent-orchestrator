// v3/sprites.jsx — pixel agents (24x32), redrawn with accessories + idle anim

function PxSprite({ agent, size = 64, animate = true, action = "idle" }) {
  const s = agent.sprite || {};
  const skin  = s.skin  || "#F5C68C";
  const hair  = s.hair  || "#3B2F2A";
  const shirt = s.shirt || "#77216F";
  const acc   = s.accessory || null;
  const W = 24, H = 32;
  const px = size / W;
  // Helpers
  const r = (x, y, c, w=1, h=1) => <rect key={`${x},${y},${c}`} x={x*px} y={y*px} width={w*px} height={h*px} fill={c} />;
  const pants = "#2C001E";
  const shoes = "#1E1A18";
  const skinShade = shadeColor(skin, -18);
  const hairShade = shadeColor(hair, -25);
  const shirtShade = shadeColor(shirt, -22);
  const shirtLight = shadeColor(shirt, 18);

  const cells = [];
  // Head (rows 6-13)
  // hair top
  cells.push([8,4,hair,8,1]);
  cells.push([7,5,hair,10,1]);
  cells.push([7,6,hair,10,1]);
  cells.push([7,7,hair,1,1]); cells.push([16,7,hair,1,1]);
  // face
  cells.push([8,7,skin,8,1]);
  cells.push([8,8,skin,8,1]);
  cells.push([8,9,skin,8,1]);
  cells.push([8,10,skin,8,1]);
  cells.push([8,11,skin,8,1]);
  // shadow under chin
  cells.push([9,12,skinShade,6,1]);
  // hair side
  cells.push([7,8,hair,1,1]); cells.push([16,8,hair,1,1]);
  cells.push([7,9,hair,1,1]); cells.push([16,9,hair,1,1]);
  // hair highlight
  cells.push([8,4,hairShade,2,1]);
  // ears
  cells.push([7,9,skin,1,1]); cells.push([16,9,skin,1,1]);
  // eyes — placed as separate elements w/ blink animation
  // (rendered separately to apply animation)

  // mouth
  cells.push([11,11,skinShade,2,1]);

  // body / shirt
  cells.push([8,13,shirt,8,1]);
  cells.push([7,14,shirt,10,1]);
  cells.push([7,15,shirt,10,1]);
  cells.push([7,16,shirt,10,1]);
  cells.push([7,17,shirt,10,1]);
  cells.push([7,18,shirt,10,1]);
  // shirt seam
  cells.push([11,14,shirtShade,2,5]);
  // shirt highlight
  cells.push([8,13,shirtLight,1,1]);
  // arms
  cells.push([6,15,shirt,1,3]);
  cells.push([17,15,shirt,1,3]);
  // hands
  cells.push([6,18,skin,1,1]);
  cells.push([17,18,skin,1,1]);
  // belt
  cells.push([7,19,pants,10,1]);
  // legs
  cells.push([8,20,pants,3,4]);
  cells.push([13,20,pants,3,4]);
  // shoes
  cells.push([8,24,shoes,3,1]);
  cells.push([13,24,shoes,3,1]);

  // accessories
  if (acc === "glasses") {
    cells.push([8,9,"#1E1A18",2,1]);
    cells.push([14,9,"#1E1A18",2,1]);
    cells.push([10,9,"#1E1A18",4,1]);
  }
  if (acc === "cap") {
    cells.push([7,4,"#1E1A18",10,1]);
    cells.push([6,5,"#1E1A18",12,1]);
    cells.push([8,5,shadeColor("#1E1A18", 25),1,1]);
  }
  if (acc === "headphones") {
    cells.push([6,6,"#1E1A18",1,3]);
    cells.push([17,6,"#1E1A18",1,3]);
    cells.push([7,5,"#1E1A18",10,1]);
  }
  if (acc === "earbuds") {
    cells.push([7,9,"#FFFFFF",1,1]);
    cells.push([16,9,"#FFFFFF",1,1]);
  }

  // typing keyboard indicator (only when action=typing)
  const isTyping = action === "typing" || agent.status === "working";

  return (
    <div className={"sprite-stage " + (animate ? "bob " : "") + (action === "typing" ? "typing" : "")}>
      <svg width={size} height={size * H/W} viewBox={`0 0 ${W} ${H}`} shapeRendering="crispEdges">
        {cells.map(([x,y,c,w,h], i) => <rect key={i} x={x} y={y} width={w||1} height={h||1} fill={c} />)}
        {/* eyes with blink */}
        <g className={animate ? "eye" : ""}>
          <rect x="9" y="9" width="1" height="1" fill="#1E1A18" />
          <rect x="14" y="9" width="1" height="1" fill="#1E1A18" />
        </g>
        {/* monitor glow when typing */}
        {isTyping && action === "typing" && (
          <rect x="6" y="20" width="12" height="1" fill="#E95420" opacity="0.5" />
        )}
      </svg>
    </div>
  );
}

function shadeColor(hex, percent) {
  // small color shade helper
  const f = parseInt(hex.slice(1), 16);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  const R = f >> 16, G = (f >> 8) & 0x00FF, B = f & 0x0000FF;
  const r = Math.round((t - R) * p) + R;
  const g = Math.round((t - G) * p) + G;
  const b = Math.round((t - B) * p) + B;
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// Tiny icons set
const II = {
  Home:     (p) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>,
  Users:    (p) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/></svg>,
  Activity: (p) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  Settings: (p) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>,
  Templates:(p) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  Memory:   (p) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10v4M11 10v4M15 10v4"/></svg>,
  Plus:     (p) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14"/></svg>,
  Send:     (p) => <svg viewBox="0 0 24 24" className="i" fill="currentColor" stroke="none" {...p}><path d="M3 11.5 21 3l-8.5 18-2-7.5-7.5-2z"/></svg>,
  Attach:   (p) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m21 12-9 9a5.5 5.5 0 0 1-7.8-7.8l9-9a3.7 3.7 0 0 1 5.2 5.2l-9 9a1.8 1.8 0 0 1-2.6-2.6l8.5-8.5"/></svg>,
  Image:    (p) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>,
  Slash:    (p) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" {...p}><path d="m17 4-10 16"/></svg>,
  Copy:     (p) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  Branch:   (p) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 8v8M8 6h5a5 5 0 0 1 5 5"/></svg>,
  Refresh:  (p) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>,
  Edit:     (p) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/></svg>,
  X:        (p) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M6 6l12 12M18 6 6 18"/></svg>,
  Chevron:  (p) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m9 18 6-6-6-6"/></svg>,
  ChevronDown:(p)=> <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m6 9 6 6 6-6"/></svg>,
  Play:     (p) => <svg viewBox="0 0 24 24" className="i" fill="currentColor" stroke="none" {...p}><path d="M8 5v14l11-7z"/></svg>,
  Stop:     (p) => <svg viewBox="0 0 24 24" className="i" fill="currentColor" stroke="none" {...p}><rect x="6" y="6" width="12" height="12" rx="1"/></svg>,
  Map:      (p) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m9 4-7 3v13l7-3 6 3 7-3V4l-7 3z"/><path d="M9 4v13M15 7v13"/></svg>,
  Grid:     (p) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  Folder:   (p) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>,
  Cpu:      (p) => <svg viewBox="0 0 24 24" className="i" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/></svg>,
};

Object.assign(window, { PxSprite, II });
