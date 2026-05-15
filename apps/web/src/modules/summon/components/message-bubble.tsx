"use client";

import { useEffect, useRef, useState } from "react";
import type { OfficeAgent } from "@/modules/office/hooks/use-office-agents";
import type { ThreadItem } from "../utils/thread-types";
import {
  AoBot,
  AoCheck,
  AoChevronRight,
  AoClose,
  AoCode,
  AoCornerDown,
  AoFolder,
  AoGlobe,
  AoList,
  AoPen,
  AoReset,
  AoSearch,
  AoSend,
  AoSparkle,
  AoTerminal,
  AoWrench,
} from "@/modules/summon/components/ao-icons";

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
    <div className="ao-lightbox" onClick={onClose} role="dialog" aria-modal>
      <img
        src={src}
        alt="Attachment preview"
        onClick={(e) => e.stopPropagation()}
      />
      <button className="ao-lightbox-close" onClick={onClose} aria-label="Close">✕</button>
    </div>
  );
}

// ── Inline image thumbnail ────────────────────────────────────────────────────
function InlineImage({ src }: { src: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="ao-img-thumb" onClick={() => setOpen(true)} aria-label="View image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Attachment" />
      </button>
      {open && <Lightbox src={src} onClose={() => setOpen(false)} />}
    </>
  );
}

// ── Image strip (row of thumbnails) ──────────────────────────────────────────
function ImageStrip({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;
  return (
    <div className="ao-img-strip">
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
const TOOL_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  Read: AoFolder,
  Write: AoPen,
  Edit: AoPen,
  Bash: AoTerminal,
  Grep: AoSearch,
  WebFetch: AoGlobe,
  WebSearch: AoSearch,
  Agent: AoList,
};

function ToolIcon({ name, size = 13 }: { name: string; size?: number }) {
  const C = TOOL_ICONS[name] ?? AoWrench;
  return <C size={size} />;
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
            <AoCode size={12} /> copy
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
    <div className="ao-msg-actions">
      <button type="button" aria-label="Copy" title="Copy" onClick={handleCopy}>
        {copied
          ? <AoCheck size={13} className="text-[var(--ao-ok)]" />
          : <AoCode size={13} />}
      </button>
      {onRerun && (
        <button type="button" aria-label="Rerun" title="Rerun" onClick={() => onRerun(text)}>
          <AoReset size={13} />
        </button>
      )}
    </div>
  );
}

// ── Single tool call detail panel ─────────────────────────────────────────────
function ToolCallRow({ name, arg }: { name: string; arg?: string }) {
  const [showIn, setShowIn] = useState(false);
  return (
    <div className="ao-tool-call">
      <div className="ao-row">
        <span className="ao-icon"><ToolIcon name={name} /></span>
        <span className="ao-name">{name}</span>
        {arg && <span className="ao-arg">{arg}</span>}
        <span className="ao-right">
          <span className="ao-badge ao-ok ao-dot text-[9px] px-[6px] py-[1px]">ok</span>
        </span>
      </div>
      {arg && (
        <div className="ao-io">
          <div className={`ao-io-panel${showIn ? " ao-open" : ""}`}>
            <div className="ao-io-head" onClick={() => setShowIn(!showIn)}>
              <AoChevronRight size={11} className="ao-chev" />
              input
              <span className="ao-count">{arg.length} chars</span>
            </div>
            {showIn && <div className="ao-io-body">{arg}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tool group row (exported — used by chat-thread for grouped tool chains) ───
export function ToolGroupRow({
  tools,
  avatar,
  running = false,
}: {
  tools: Array<{ id: string; name: string; arg?: string }>;
  avatar: string;
  running?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const single = tools.length === 1;
  const first = tools[0]!;
  const statusClass = running ? "ao-running" : "ao-ok";

  return (
    <div className="ao-msg ao-agent">
      <div className="ao-av ao-agent" aria-hidden>
        <span className="text-base">{avatar}</span>
      </div>
      <div className="ao-body w-full">
        <div className={`ao-tool-group${open ? " ao-open" : ""}`}>
          <div className="ao-head" onClick={() => setOpen(!open)}>
            <span className={`ao-status-dot ${statusClass}`} />
            <span className="ao-icon"><AoWrench size={13} /></span>
            <span className="ao-name">
              {single ? (
                <>
                  <ToolIcon name={first.name} />
                  {first.name}
                  {first.arg && <span className="ao-arg">{first.arg}</span>}
                </>
              ) : (
                <>
                  {tools.length} tool calls
                  <span className="ao-muted ao-mono ao-tiny ml-1">
                    {[...new Set(tools.map((t) => t.name))].join(" · ")}
                  </span>
                </>
              )}
            </span>
            <span className="ao-chev"><AoChevronRight size={14} /></span>
          </div>
          {open && (
            <div className="ao-body">
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
function ThinkingRow({ text, avatar }: { text: string; avatar: string }) {
  const [open, setOpen] = useState(false);
  const tokenEst = Math.max(1, Math.round(text.split(/\s+/).length * 1.3));
  return (
    <div className="ao-msg ao-agent">
      <div className="ao-av ao-agent" aria-hidden>
        <span className="text-base">{avatar}</span>
      </div>
      <div className="ao-body w-full">
        <div className={`ao-thinking${open ? " ao-open" : ""}`}>
          <div className="ao-head" onClick={() => setOpen(!open)}>
            <span className="ao-icon"><AoSparkle size={13} /></span>
            <span>Thinking…</span>
            <span className="ao-right">
              <span>~{tokenEst} tokens</span>
              <AoChevronRight size={12} className="ao-chev" />
            </span>
          </div>
          {open && <div className="ao-body">{text}</div>}
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
    <div className="ao-clarify mt-3">
      <div className="ao-top">
        <span className="ao-led" aria-hidden />
        Needs your reply
        <span className="ao-mono ml-auto normal-case tracking-normal">
          ↵ send
        </span>
      </div>
      <div className="ao-reply">
        <AoCornerDown size={13} className="text-[var(--ao-fg-3)] shrink-0" />
        <input
          ref={inputRef}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          placeholder="Type your reply…"
          autoFocus
        />
        <button type="button" onClick={send}>
          <AoSend size={11} /> Reply
        </button>
      </div>
    </div>
  );
}

// ── SubAgentCard ──────────────────────────────────────────────────────────────
function SubAgentCard({ item }: { item: Extract<ThreadItem, { kind: "agent-subagent" }> }) {
  const [open, setOpen] = useState(false);
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
    item.status === "done" ? "ao-subagent-badge ok" :
    item.status === "error" ? "ao-subagent-badge err" :
    "ao-subagent-badge running";

  return (
    <div className="ao-subagent-card">
      <div className="ao-subagent-head" onClick={() => setOpen((o) => !o)} role="button" aria-expanded={open}>
        <div className="ao-subagent-av" aria-hidden>
          <AoBot size={13} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="ao-subagent-label">spawned sub-agent</div>
          <div className="ao-subagent-name">
            {item.name}
            <span className={badgeClass}>{item.status}</span>
          </div>
        </div>
        <div className="ao-subagent-right">
          {duration && <span>{duration}</span>}
          <AoChevronRight
            size={13}
            style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.18s" }}
          />
        </div>
      </div>
      {open && (
        <div className="ao-subagent-prompt">{item.prompt}</div>
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
};

export function MessageBubble({ item, agent, isQuestion, onReply, onRerun }: MessageBubbleProps) {
  const avatar = agent.short[0]?.toUpperCase() ?? "?";

  switch (item.kind) {
    case "you": {
      const youImgs = extractImages(item.text);
      const youText = stripAttachmentFooter(item.text);
      return (
        <div className="ao-msg ao-user">
          <div className="ao-av ao-you" aria-hidden>P</div>
          <div className="flex flex-col items-end">
            <div className="ao-bubble">
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
        <div className="ao-msg ao-agent">
          <div className="ao-av ao-agent" aria-hidden>
            <span className="text-base">{avatar}</span>
          </div>
          <div className="ao-body">
            <div className="ao-who">
              <span>{agent.name}</span>
              {item.streaming ? (
                <span className="ao-stamp text-[var(--ao-accent)]">typing…</span>
              ) : null}
            </div>
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
          tools={[{ id: item.id, name: item.name, arg: item.arg }]}
          avatar={avatar}
        />
      );

    case "agent-subagent":
      return <SubAgentCard item={item} />;

    case "agent-thinking":
      return <ThinkingRow text={item.text} avatar={avatar} />;

    case "system-error":
      return (
        <div className="ao-err-card">
          <div className="ao-icon"><AoClose size={13} /></div>
          <div className="ao-body">
            <div className="ao-title">Run error</div>
            <div className="ao-detail">{item.message}</div>
            <div className="ao-retry"><AoReset size={11} /> Retry</div>
          </div>
        </div>
      );

    case "system-done":
      return (
        <div className="ao-run-done">
          <span className="ao-line" />
          <span className="ao-pill">
            <span className="ao-ok">
              <AoCheck size={11} />
              {item.exitCode === 0 ? "Done" : `Exited ${item.exitCode}`}
            </span>
          </span>
          <span className="ao-line" />
        </div>
      );

    default: {
      const _exhaustive: never = item;
      return null;
    }
  }
}
