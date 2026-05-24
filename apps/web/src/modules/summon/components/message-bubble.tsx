"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { OfficeAgent } from "@/modules/office/hooks/use-office-agents";
import type { ThreadItem } from "../utils/thread-types";
import { Icon, type IconName } from "@/components/ui/icon";

// ── Expanded-state context ────────────────────────────────────────────────────
// A stable Map<id, open> lives in ChatThread (via useRef) so that collapsible
// sections survive re-renders and remounts during streaming.
export const ExpandedStateContext = createContext<{
  get: (id: string) => boolean;
  set: (id: string, val: boolean) => void;
} | null>(null);

function useExpandedState(id: string): [boolean, () => void] {
  const ctx = useContext(ExpandedStateContext);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const [open, setOpen] = useState(() => ctx?.get(id) ?? false);
  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      ctxRef.current?.set(id, next);
      return next;
    });
  }, [id]);
  return [open, toggle];
}

// ── Duration formatter ────────────────────────────────────────────────────────
function fmtDuration(ms: number): string {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

// ── Image handling ────────────────────────────────────────────────────────────
const IMG_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i;

/** Convert a local upload path to a servable API URL, or return http(s) URLs as-is. */
function pathToUrl(raw: string): string | null {
  // Agent uploads: ~/.claude/agents/_uploads/{agentId}/{filename}
  const agentM = raw.match(/\.claude\/agents\/_uploads\/([^/\s]+)\/([^/\s]+)$/);
  if (agentM && IMG_EXT.test(agentM[2]!)) {
    return `/api/agents/${encodeURIComponent(agentM[1]!)}/uploads/${encodeURIComponent(agentM[2]!)}`;
  }
  // Project uploads: ~/.claude/projects/{projectId}/_uploads/{filename}
  const projM = raw.match(/\.claude\/projects\/([^/\s]+)\/_uploads\/([^/\s]+)$/);
  if (projM && IMG_EXT.test(projM[2]!)) {
    return `/api/projects/${encodeURIComponent(projM[1]!)}/uploads/${encodeURIComponent(projM[2]!)}`;
  }
  // Plain HTTP/HTTPS image URL
  if (/^https?:\/\/.+/i.test(raw) && IMG_EXT.test(raw.split("?")[0]!)) {
    return raw;
  }
  return null;
}

/** Extract image references from message text, returning their API URLs. */
function extractImages(text: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  // Absolute paths ending in image extension
  const pathRe = /(\/[^\s,'"<>()[\]]+)/g;
  let m: RegExpExecArray | null;
  while ((m = pathRe.exec(text)) !== null) {
    const raw = m[1]!;
    if (!IMG_EXT.test(raw)) continue;
    const url = pathToUrl(raw);
    if (url && !seen.has(url)) { seen.add(url); urls.push(url); }
  }
  // HTTP/HTTPS URLs
  const urlRe = /https?:\/\/[^\s,'"<>()[\]]+/g;
  while ((m = urlRe.exec(text)) !== null) {
    const raw = m[0]!;
    if (!IMG_EXT.test(raw.split("?")[0]!)) continue;
    if (!seen.has(raw)) { seen.add(raw); urls.push(raw); }
  }
  return urls;
}

/** Strip the attachment footer that Claude Code appends ("Attachments (read these...)\n- /path"). */
function stripAttachmentFooter(text: string): string {
  return text.replace(/\n\nAttachments \(read these with your tools\):[^\n]*(?:\n- [^\n]+)*/g, "").trimEnd();
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center cursor-zoom-out [animation:ao-lb-in_0.15s_ease]"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Attachment preview"
        className="max-w-[min(90vw,1400px)] max-h-[90vh] w-auto h-auto rounded-[10px] shadow-[0_24px_80px_rgba(0,0,0,0.6)] cursor-default"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        className="fixed top-[20px] right-[24px] w-[36px] h-[36px] rounded-full bg-white/[0.12] border border-white/[0.2] text-white text-[16px] cursor-pointer flex items-center justify-center transition-[background] duration-[120ms] hover:bg-white/[0.22]"
        onClick={onClose}
        aria-label="Close"
      >✕</button>
    </div>
  );
}

// ── Inline image thumbnail ────────────────────────────────────────────────────
function InlineImage({ src }: { src: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="block p-0 border border-ao-line-1 rounded-[8px] overflow-hidden cursor-zoom-in bg-ao-bg-3 transition-[border-color,box-shadow] duration-[120ms] shrink-0"
        onClick={() => setOpen(true)}
        aria-label="View image"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Attachment" className="block max-w-[180px] max-h-[140px] w-auto h-auto object-cover" />
      </button>
      {open && <Lightbox src={src} onClose={() => setOpen(false)} />}
    </>
  );
}

// ── Image strip (row of thumbnails) ──────────────────────────────────────────
function ImageStrip({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {urls.map((url) => <InlineImage key={url} src={url} />)}
    </div>
  );
}

type ProseItem = string | { type: "code"; lang: string; body: string };

// ── Syntax highlighter ────────────────────────────────────────────────────────
function highlightTS(src: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let out = esc(src);
  out = out.replace(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g, "\x01C\x01$1\x02");
  out = out.replace(/(['"`])((?:\\.|(?!\1).)*)\1/g, "\x01S\x01$&\x02");
  out = out.replace(
    /\b(?:import|from|export|async|await|function|return|const|let|var|if|else|new|class|interface|type|extends|implements|public|private|protected|throw|try|catch|null|true|false|void)\b/g,
    "\x01K\x01$&\x02",
  );
  out = out.replace(/\b(?:Request|Response|Date|Promise|Session|Map)\b/g, "\x01T\x01$&\x02");
  out = out.replace(/\b\d+(?:\.\d+)?\b/g, "\x01N\x01$&\x02");
  out = out.replace(/\b([a-zA-Z_$][\w$]*)(?=\()/g, "\x01F\x01$&\x02");
  return out
    .replace(/\x01C\x01([\s\S]*?)\x02/gs, '<span class="tk-com">$1</span>')
    .replace(/\x01S\x01([\s\S]*?)\x02/g,  '<span class="tk-str">$1</span>')
    .replace(/\x01K\x01([\s\S]*?)\x02/g,  '<span class="tk-key">$1</span>')
    .replace(/\x01T\x01([\s\S]*?)\x02/g,  '<span class="tk-typ">$1</span>')
    .replace(/\x01N\x01([\s\S]*?)\x02/g,  '<span class="tk-num">$1</span>')
    .replace(/\x01F\x01([\s\S]*?)\x02/g,  '<span class="tk-fn">$1</span>');
}

// ── Inline markdown ───────────────────────────────────────────────────────────
function inlineMd(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

// ── Parse text string into prose items (handles ```fenced``` blocks) ──────────
function parseText(text: string): ProseItem[] {
  const items: ProseItem[] = [];
  const re = /```(\w*)\n([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      for (const line of text.slice(last, m.index).split("\n")) items.push(line);
    }
    items.push({ type: "code", lang: m[1] || "text", body: (m[2] ?? "").replace(/\n$/, "") });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    for (const line of text.slice(last).split("\n")) items.push(line);
  }
  return items;
}

function copyText(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => undefined);
  }
}

// ── Tool icon map ─────────────────────────────────────────────────────────────
const TOOL_ICONS: Record<string, IconName> = {
  Read: "folder",
  Write: "edit",
  Edit: "edit",
  Bash: "terminal-ao",
  Grep: "search",
  WebFetch: "globe",
  WebSearch: "search",
  Agent: "list",
};

function ToolIcon({ name, size = 13 }: { name: string; size?: number }) {
  const iconName = TOOL_ICONS[name] ?? "wrench";
  return <Icon name={iconName} size={size} />;
}

// ── Code block ────────────────────────────────────────────────────────────────
function CodeBlock({ lang, body }: { lang: string; body: string }) {
  const lines = body.split("\n").length;
  return (
    <div className="ao-codeblock">
      <div className="ao-head">
        <span className="ao-lang">{lang || "text"}</span>
        <span className="ao-dot" />
        <span>{lines} {lines === 1 ? "line" : "lines"}</span>
        <div className="ao-actions">
          <button type="button" onClick={() => copyText(body)}>
            <Icon name="code" size={12} /> copy
          </button>
        </div>
      </div>
      <pre dangerouslySetInnerHTML={{ __html: highlightTS(body) }} />
    </div>
  );
}

// ── Prose block ───────────────────────────────────────────────────────────────
function ProseBlock({ items, streaming }: { items: ProseItem[]; streaming?: boolean }) {
  const out: React.ReactNode[] = [];
  let paraBuf: string[] = [];
  let listBuf: string[] = [];

  const flushPara = (key: string) => {
    if (!paraBuf.length) return;
    out.push(<p key={key} dangerouslySetInnerHTML={{ __html: inlineMd(paraBuf.join(" ")) }} />);
    paraBuf = [];
  };
  const flushList = (key: string) => {
    if (!listBuf.length) return;
    out.push(
      <ul key={key}>
        {listBuf.map((it, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: inlineMd(it) }} />
        ))}
      </ul>,
    );
    listBuf = [];
  };

  items.forEach((item, idx) => {
    const k = `n${idx}`;
    if (typeof item === "object" && item.type === "code") {
      flushPara(`p${k}`); flushList(`l${k}`);
      out.push(<CodeBlock key={k} lang={item.lang} body={item.body} />);
      return;
    }
    const ln = item as string;
    if (/^#{2,3}\s+/.test(ln)) {
      flushPara(`p${k}`); flushList(`l${k}`);
      out.push(<h3 key={k} dangerouslySetInnerHTML={{ __html: inlineMd(ln.replace(/^#{2,3}\s+/, "")) }} />);
      return;
    }
    if (/^[-*]\s+/.test(ln)) { flushPara(`p${k}`); listBuf.push(ln.replace(/^[-*]\s+/, "")); return; }
    if (/^\d+\.\s+/.test(ln)) { flushPara(`p${k}`); listBuf.push(ln.replace(/^\d+\.\s+/, "")); return; }
    if (ln.trim() === "") { flushPara(`p${k}`); flushList(`l${k}`); return; }
    flushList(`l${k}`);
    paraBuf.push(ln);
  });

  flushPara("pf"); flushList("lf");

  if (streaming) {
    out.push(<p key="tail"><span className="ao-cursor" aria-hidden /></p>);
  }
  return <>{out}</>;
}

// ── Message actions ───────────────────────────────────────────────────────────
function MsgActions({ text, onRerun }: { text: string; onRerun?: (t: string) => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="absolute top-[-4px] right-0 flex gap-1 p-[2px] bg-ao-bg-2 border border-ao-line-1 rounded-[8px] opacity-0 -translate-y-[2px] transition-[opacity,transform] duration-[140ms] z-[2] group-hover/msg:opacity-100 group-hover/msg:translate-y-0">
      <button
        type="button"
        className="w-[26px] h-[26px] grid place-items-center rounded-[6px] text-ao-fg-2 hover:bg-ao-bg-3 hover:text-ao-fg-0"
        aria-label="Copy"
        title="Copy"
        onClick={handleCopy}
      >
        {copied
          ? <Icon name="check" size={13} className="text-[var(--ao-ok)]" />
          : <Icon name="code" size={13} />}
      </button>
      {onRerun && (
        <button
          type="button"
          className="w-[26px] h-[26px] grid place-items-center rounded-[6px] text-ao-fg-2 hover:bg-ao-bg-3 hover:text-ao-fg-0"
          aria-label="Rerun"
          title="Rerun"
          onClick={() => onRerun(text)}
        >
          <Icon name="refresh" size={13} />
        </button>
      )}
    </div>
  );
}

// ── Single tool call detail panel ─────────────────────────────────────────────
function ToolCallRow({ name, arg }: { name: string; arg?: string }) {
  const [showIn, setShowIn] = useState(false);
  return (
    <div className="px-[14px] py-[10px] border-t border-[var(--ao-line-0)] first:border-t-0">
      <div className="flex items-center gap-2 text-[12.5px]">
        <span className="w-[18px] h-[18px] grid place-items-center text-ao-fg-2 shrink-0"><ToolIcon name={name} /></span>
        <span className="text-ao-fg-0 font-medium">{name}</span>
        {arg && <span className="font-mono text-[11.5px] text-ao-fg-2 px-[6px] py-[1px] bg-ao-bg-3 border border-ao-line-1 rounded-[4px] whitespace-nowrap overflow-hidden text-ellipsis max-w-[360px]">{arg}</span>}
        <span className="ml-auto flex items-center gap-2 text-ao-fg-3 font-mono text-[11px]">
          <span className="inline-flex items-center gap-[5px] py-[1px] px-[6px] rounded-full text-[9px] font-semibold tracking-[0.06em] uppercase font-mono border bg-[var(--ao-ok-soft)] text-[var(--ao-ok)] border-[rgba(78,185,111,0.25)]"><span className="text-[7px]">●</span>ok</span>
        </span>
      </div>
      {arg && (
        <div className="mt-2 grid grid-cols-1 gap-[6px]">
          <div className={`border border-[var(--ao-line-0)] rounded-[6px] overflow-hidden bg-[var(--ao-bg-1)]${showIn ? " ao-open" : ""}`}>
            <div
              className="flex items-center gap-2 px-[10px] py-[5px] font-mono text-[10.5px] text-ao-fg-2 uppercase tracking-[0.08em] cursor-pointer hover:text-ao-fg-0"
              onClick={() => setShowIn(!showIn)}
            >
              <Icon name="chevron" size={11} className="transition-transform duration-[180ms] [.ao-open_&]:rotate-90 [.ao-open_&]:text-[var(--ao-accent)]" />
              input
              <span className="ml-auto text-ao-fg-3 normal-case tracking-normal">{arg.length} chars</span>
            </div>
            {showIn && <div className="border-t border-[var(--ao-line-0)] p-[8px_10px] font-mono text-[11.5px] leading-[1.55] text-ao-fg-0 max-h-[200px] overflow-y-auto whitespace-pre-wrap break-words">{arg}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tool group row (exported - used by chat-thread for grouped tool chains) ───
export function ToolGroupRow({
  id,
  tools,
  avatar,
  running = false,
  hideAvatar = false,
}: {
  id: string;
  tools: Array<{ id: string; name: string; arg?: string }>;
  avatar: string;
  running?: boolean;
  hideAvatar?: boolean;
}) {
  const [open, toggle] = useExpandedState(id);
  const single = tools.length === 1;
  const first = tools[0]!;
  return (
    <div className="flex items-start gap-[12px] relative group/msg">
      {hideAvatar ? (
        <div className="w-[30px] shrink-0" aria-hidden />
      ) : (
        <div className="w-[30px] h-[30px] rounded-full shrink-0 grid place-items-center font-bold text-[18px] text-white border border-ao-line-1 bg-ao-bg-3 [image-rendering:pixelated]" aria-hidden>
          <span className="text-base">{avatar}</span>
        </div>
      )}
      <div className="flex-1 min-w-0 w-full">
        <div className={`border border-ao-line-1 rounded-[10px] bg-ao-bg-2 overflow-hidden${open ? " ao-open" : ""}`}>
          <div className="flex items-center gap-[10px] px-[14px] py-[10px] cursor-pointer select-none transition-[background] duration-[120ms] hover:bg-ao-bg-3" onClick={toggle}>
            <span className={`w-[6px] h-[6px] rounded-full shrink-0 ${running ? "bg-[var(--ao-ok)] shadow-[0_0_6px_rgba(78,185,111,0.5)] animate-[ao-pulse_1.5s_infinite]" : "bg-[var(--ao-ok)] shadow-[0_0_6px_rgba(78,185,111,0.5)]"}`} />
            <span className="w-[22px] h-[22px] grid place-items-center rounded-[6px] bg-ao-bg-3 text-ao-fg-1 shrink-0 border border-ao-line-1"><Icon name="wrench" size={13} /></span>
            <span className="text-[13px] text-ao-fg-0 font-medium flex items-center gap-2 flex-1 min-w-0">
              {single ? (
                <>
                  <ToolIcon name={first.name} />
                  {first.name}
                  {first.arg && <span className="font-mono text-[11.5px] text-ao-fg-2 px-[6px] py-[1px] bg-ao-bg-3 border border-ao-line-1 rounded-[4px] whitespace-nowrap overflow-hidden text-ellipsis max-w-[320px]">{first.arg}</span>}
                </>
              ) : (
                <>
                  {tools.length} tool calls
                  <span className="text-ao-fg-2 font-mono text-[11.5px] ml-1">
                    {[...new Set(tools.map((t) => t.name))].join(" · ")}
                  </span>
                </>
              )}
            </span>
            <span className="text-ao-fg-3 transition-transform duration-[180ms] [.ao-open_&]:rotate-90 [.ao-open_&]:text-[var(--ao-accent)]"><Icon name="chevron" size={14} /></span>
          </div>
          {open && (
            <div className="border-t border-[var(--ao-line-0)] p-0">
              {tools.map((t) => (
                <ToolCallRow key={t.id} name={t.name} arg={t.arg} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Thinking row ──────────────────────────────────────────────────────────────
function ThinkingRow({ id, text, avatar, hideAvatar = false }: { id: string; text: string; avatar: string; hideAvatar?: boolean }) {
  const [open, toggle] = useExpandedState(id);
  const tokenEst = Math.max(1, Math.round(text.split(/\s+/).length * 1.3));
  return (
    <div className="flex items-start gap-[12px] relative group/msg">
      {hideAvatar ? (
        <div className="w-[30px] shrink-0" aria-hidden />
      ) : (
        <div className="w-[30px] h-[30px] rounded-full shrink-0 grid place-items-center font-bold text-[18px] text-white border border-ao-line-1 bg-ao-bg-3 [image-rendering:pixelated]" aria-hidden>
          <span className="text-base">{avatar}</span>
        </div>
      )}
      <div className="flex-1 min-w-0 w-full">
        <div className={`border border-dashed border-ao-line-1 rounded-[10px] bg-white/[0.015]${open ? " ao-open" : ""}`}>
          <div className="flex items-center gap-[10px] px-[14px] py-[9px] cursor-pointer text-ao-fg-2 text-[12.5px] italic" onClick={toggle}>
            <span className="text-ao-fg-3"><Icon name="sparkle" size={13} /></span>
            <span>Thinking…</span>
            <span className="ml-auto flex items-center gap-2 font-mono text-[11px] text-ao-fg-3 not-italic">
              <span>~{tokenEst} tokens</span>
              <Icon name="chevron" size={12} className="transition-transform duration-[180ms] text-ao-fg-3 [.ao-open_&]:rotate-90 [.ao-open_&]:text-[var(--ao-accent)]" />
            </span>
          </div>
          {open && <div className="border-t border-dashed border-ao-line-1 px-[14px] py-[10px] font-mono text-[12px] leading-[1.6] text-ao-fg-1 whitespace-pre-wrap">{text}</div>}
        </div>
      </div>
    </div>
  );
}

// ── Clarify input strip ───────────────────────────────────────────────────────
function ClarifyInput({ onReply }: { onReply: (text: string) => void }) {
  const [val, setVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const send = () => {
    const v = val.trim();
    if (!v) return;
    onReply(v);
  };

  return (
    <div className="border border-[rgba(230,179,90,0.30)] bg-[linear-gradient(90deg,rgba(230,179,90,0.10),rgba(230,179,90,0.02)_70%)] rounded-[10px] p-[14px_16px] flex flex-col gap-[12px] mt-3">
      <div className="flex items-center gap-2 text-[11px] text-[var(--ao-warn)] uppercase tracking-[0.1em] font-mono font-bold">
        <span className="w-[6px] h-[6px] rounded-full bg-[var(--ao-warn)] shadow-[0_0_6px_var(--ao-warn)] animate-[ao-pulse_1.5s_infinite]" aria-hidden />
        Needs your reply
        <span className="font-mono ml-auto normal-case tracking-normal">↵ send</span>
      </div>
      <div className="flex items-center gap-2 pl-[14px] py-2 pr-[10px] bg-[var(--ao-bg-1)] border border-ao-line-1 rounded-[8px] focus-within:border-[rgba(230,179,90,0.5)] focus-within:[box-shadow:0_0_0_3px_rgba(230,179,90,0.10)]">
        <Icon name="corner-down" size={13} className="text-[var(--ao-fg-3)] shrink-0" />
        <input
          ref={inputRef}
          className="flex-1 bg-transparent border-0 outline-none text-ao-fg-0 text-[13.5px]"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          placeholder="Type your reply…"
          autoFocus
        />
        <button
          type="button"
          className="inline-flex items-center gap-[6px] px-3 py-[6px] bg-[var(--ao-warn)] text-[#2a1d05] rounded-[6px] font-semibold text-[12.5px]"
          onClick={send}
        >
          <Icon name="send" size={11} /> Reply
        </button>
      </div>
    </div>
  );
}

// ── SubAgentCard ──────────────────────────────────────────────────────────────
function SubAgentCard({ item }: { item: Extract<ThreadItem, { kind: "agent-subagent" }> }) {
  const [open, toggle] = useExpandedState(item.id);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (item.status !== "running") return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - item.startTs) / 1000)), 1000);
    return () => clearInterval(id);
  }, [item.status, item.startTs]);

  const duration =
    item.status === "running"
      ? `${elapsed}s`
      : item.durationMs !== undefined
        ? `${(item.durationMs / 1000).toFixed(1)}s`
        : undefined;

  const badgeClass =
    item.status === "done" ? "text-[10px] font-medium px-[7px] py-[1px] rounded-full border border-transparent ok" :
    item.status === "error" ? "text-[10px] font-medium px-[7px] py-[1px] rounded-full border border-transparent err" :
    "text-[10px] font-medium px-[7px] py-[1px] rounded-full border border-transparent running";

  return (
    <div className="my-1 ml-[14px] border-l-2 border-l-[#3b7de8] px-[14px] py-[10px] bg-[linear-gradient(90deg,rgba(59,125,232,0.09)_0%,transparent_72%)] rounded-[0_10px_10px_0]">
      <div className="flex items-center gap-[10px] cursor-pointer select-none" onClick={toggle} role="button" aria-expanded={open}>
        <div className="w-6 h-6 rounded-full bg-[linear-gradient(135deg,#3b7de8_0%,#1e56c0_100%)] grid place-items-center text-white shrink-0" aria-hidden>
          <Icon name="bot-ao" size={13} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] tracking-[0.08em] uppercase text-[#74a8f0] mb-[2px]">spawned sub-agent</div>
          <div className="text-[13px] font-semibold text-ao-fg-0 flex items-center gap-[7px]">
            {item.name}
            <span className={badgeClass}>{item.status}</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 text-ao-fg-3 font-mono text-[11px] shrink-0">
          {duration && <span>{duration}</span>}
          <Icon
            name="chevron"
            size={13}
            style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.18s" }}
          />
        </div>
      </div>
      {open && (
        <div className="mt-[10px] px-3 py-[10px] bg-[var(--ao-bg-1)] border border-ao-line-1 rounded-[6px] font-mono text-[11.5px] text-ao-fg-1 leading-[1.55] whitespace-pre-wrap break-words">
          {item.prompt}
        </div>
      )}
    </div>
  );
}

// ── MessageBubble ─────────────────────────────────────────────────────────────
export type MessageBubbleProps = {
  item: ThreadItem;
  agent: OfficeAgent;
  /** When true, appends an inline reply strip (agent asked a question). */
  isQuestion?: boolean;
  /** Called when the user submits a reply from the inline clarify input. */
  onReply?: (text: string) => void;
  /** Called when the user reruns their own message. */
  onRerun?: (text: string) => void;
  /** Called when the user clicks Retry on an error card. */
  onRetry?: () => void;
  /** When true, hides the avatar (consecutive messages from the same sender). */
  hideAvatar?: boolean;
};

export function MessageBubble({ item, agent, isQuestion, onReply, onRerun, onRetry, hideAvatar }: MessageBubbleProps) {
  const avatar = agent.short[0]?.toUpperCase() ?? "?";

  switch (item.kind) {
    case "you": {
      const youImgs = extractImages(item.text);
      const youText = stripAttachmentFooter(item.text);
      return (
        <div className="flex flex-row-reverse self-end max-w-[80%] gap-[12px] relative group/msg">
          <div className="w-[30px] h-[30px] rounded-full shrink-0 grid place-items-center font-bold text-[12px] text-white border border-white/[0.08] bg-[linear-gradient(135deg,#d6336c_0%,#b21e5d_100%)] font-[var(--ao-font-sans)]" aria-hidden>P</div>
          <div className="flex flex-col items-end">
            <div className="bg-ao-bg-3 border border-ao-line-1 rounded-[14px_14px_4px_14px] px-4 py-3 text-[14px] leading-[1.55] text-ao-fg-0">
              {youText}
              <ImageStrip urls={youImgs} />
            </div>
            <MsgActions text={item.text} onRerun={onRerun} />
          </div>
        </div>
      );
    }

    case "agent-text": {
      const proseItems = parseText(item.text);
      const agentImgs = extractImages(item.text);
      const showClarify = isQuestion && !item.streaming && !!onReply;
      return (
        <div className="flex items-start gap-[12px] relative group/msg">
          {hideAvatar ? (
            <div className="w-[30px] shrink-0" aria-hidden />
          ) : (
            <div className="w-[30px] h-[30px] rounded-full shrink-0 grid place-items-center font-bold text-[18px] text-white border border-ao-line-1 bg-ao-bg-3 [image-rendering:pixelated]" aria-hidden>
              <span className="text-base">{avatar}</span>
            </div>
          )}
          <div className="flex-1 min-w-0 pt-0.5">
            {!hideAvatar && (
              <div className="text-[12px] font-semibold text-ao-fg-1 flex items-center gap-2 mb-[6px]">
                <span>{agent.name}</span>
                {item.streaming ? (
                  <span className="text-ao-fg-3 font-mono text-[11px] font-normal text-[var(--ao-accent)]">typing…</span>
                ) : null}
              </div>
            )}
            {hideAvatar && item.streaming && (
              <div className="text-[12px] font-semibold text-ao-fg-1 flex items-center gap-2 mb-[6px]">
                <span className="text-ao-fg-3 font-mono text-[11px] font-normal text-[var(--ao-accent)]">typing…</span>
              </div>
            )}
            <div className="ao-prose">
              <ProseBlock items={proseItems} streaming={item.streaming} />
            </div>
            <ImageStrip urls={agentImgs} />
            {showClarify ? (
              <ClarifyInput onReply={onReply} />
            ) : !item.streaming ? (
              <MsgActions text={item.text} />
            ) : null}
          </div>
        </div>
      );
    }

    case "agent-tool":
      return (
        <ToolGroupRow
          id={item.id}
          tools={[{ id: item.id, name: item.name, arg: item.arg }]}
          avatar={avatar}
        />
      );

    case "agent-subagent":
      return <SubAgentCard item={item} />;

    case "agent-thinking":
      return <ThinkingRow id={item.id} text={item.text} avatar={avatar} hideAvatar={hideAvatar} />;

    case "system-error":
      return (
        <div className="border border-[rgba(217,83,79,0.30)] border-l-[3px] border-l-[var(--ao-bad)] rounded-[8px] px-[14px] py-3 bg-[rgba(217,83,79,0.05)] flex items-start gap-[10px]">
          <div className="w-[22px] h-[22px] grid place-items-center rounded-[6px] bg-[var(--ao-bad-soft)] text-[var(--ao-bad)] shrink-0"><Icon name="x" size={13} /></div>
          <div className="flex-1">
            <div className="font-semibold text-ao-fg-0 text-[13.5px]">Run error</div>
            <div className="text-ao-fg-1 text-[12.5px] mt-0.5 font-mono">{item.message}</div>
            <button onClick={onRetry} disabled={!onRetry} className="mt-2 text-[var(--ao-bad)] text-[12px] cursor-pointer inline-flex items-center gap-1 bg-transparent border-0 p-0 disabled:opacity-40 disabled:cursor-default"><Icon name="refresh" size={11} /> Retry</button>
          </div>
        </div>
      );

    case "system-done": {
      const totalTok =
        item.tokensIn !== undefined || item.tokensOut !== undefined
          ? (item.tokensIn ?? 0) + (item.tokensOut ?? 0)
          : null;
      return (
        <div className="flex items-center gap-3 my-1">
          <span className="flex-1 h-[1px] bg-[var(--ao-line-0)]" />
          <span className="inline-flex items-center gap-[6px] px-3 py-[5px] bg-ao-bg-2 border border-ao-line-1 rounded-full font-mono text-[11px] text-ao-fg-2">
            <span className="text-[var(--ao-ok)] inline-flex items-center gap-1">
              <Icon name="check" size={11} />
              {item.exitCode === 0 ? "Done" : `Exited ${item.exitCode}`}
            </span>
            {item.durationMs !== undefined && (
              <>
                <span className="text-ao-fg-3 select-none" aria-hidden>·</span>
                <span>{fmtDuration(item.durationMs)}</span>
              </>
            )}
            {totalTok !== null && totalTok > 0 && (
              <>
                <span className="text-ao-fg-3 select-none" aria-hidden>·</span>
                <span>{totalTok.toLocaleString()} tok</span>
              </>
            )}
            {item.cost !== undefined && item.cost > 0 && (
              <>
                <span className="text-ao-fg-3 select-none" aria-hidden>·</span>
                <span>${item.cost.toFixed(4)}</span>
              </>
            )}
          </span>
          <span className="flex-1 h-[1px] bg-[var(--ao-line-0)]" />
        </div>
      );
    }

    default: {
      const _exhaustive: never = item;
      return null;
    }
  }
}
