// v3/chat.jsx - Claude/ChatGPT-style chat with tool cards, slash menu, attachments

function ChatPanel({ agent, onClose, onMinimize }) {
  const seed = window.V3_CONVOS[agent.id] || window.v3MakeGenericConvo(agent);
  const [messages, setMessages] = React.useState(seed);
  const [input, setInput] = React.useState("");
  const [tab, setTab] = React.useState("chat");
  const [attachments, setAttachments] = React.useState([]);
  const [slashOpen, setSlashOpen] = React.useState(false);
  const [slashIdx, setSlashIdx] = React.useState(0);
  const [streaming, setStreaming] = React.useState(false);
  const scrollRef = React.useRef(null);
  const textareaRef = React.useRef(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  React.useEffect(() => {
    setMessages(window.V3_CONVOS[agent.id] || window.v3MakeGenericConvo(agent));
    setInput("");
    setTab("chat");
  }, [agent.id]);

  const filteredSlash = React.useMemo(() => {
    if (!input.startsWith("/")) return [];
    const q = input.slice(1).toLowerCase();
    return window.SLASH.filter(s => s.cmd.slice(1).startsWith(q));
  }, [input]);

  const onInputChange = (e) => {
    const v = e.target.value;
    setInput(v);
    setSlashOpen(v.startsWith("/") && v.length >= 1);
    setSlashIdx(0);
    // autosize
    const ta = textareaRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = Math.min(220, ta.scrollHeight) + "px"; }
  };

  const send = () => {
    if (!input.trim() && attachments.length === 0) return;
    const userMsg = { role: "you", text: input.trim(), attachments: [...attachments], t: Date.now() };
    setMessages(m => [...m, userMsg]);
    setInput(""); setAttachments([]); setSlashOpen(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // simulate streaming response
    setStreaming(true);
    const responses = mockResponses(agent, userMsg.text);
    const stub = { role: "agent", t: Date.now(), parts: [], streaming: true };
    setMessages(m => [...m, stub]);

    let i = 0;
    const tick = () => {
      if (i >= responses.length) {
        setMessages(m => m.map((mm, idx) =>
          idx === m.length - 1 ? { ...mm, streaming: false } : mm));
        setStreaming(false);
        return;
      }
      const part = responses[i++];
      setMessages(m => m.map((mm, idx) =>
        idx === m.length - 1 ? { ...mm, parts: [...mm.parts, part] } : mm));
      setTimeout(tick, part.type === "thinking" ? 700 : part.type === "tool" ? 900 : 1100);
    };
    setTimeout(tick, 500);
  };

  const onKeyDown = (e) => {
    if (slashOpen && filteredSlash.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSlashIdx(i => Math.min(filteredSlash.length-1, i+1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSlashIdx(i => Math.max(0, i-1)); return; }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        setInput(filteredSlash[slashIdx].cmd + " ");
        setSlashOpen(false);
        return;
      }
      if (e.key === "Escape") { setSlashOpen(false); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const stopGen = () => setStreaming(false);

  return (
    <div className="chat">
      <div className="chat-head">
        <div className="av"><PxSprite agent={agent} size={40} animate={false} action={agent.status === "working" ? "typing" : "idle"} /></div>
        <div>
          <h2>{agent.name}</h2>
          <div className="sub">{agent.id} · {agent.model} · effort {agent.effort}</div>
        </div>
        <span className={"pill " + (agent.status === "working" ? "working" : "")}>
          {agent.status}
        </span>
        <div className="right">
          <button className="btn sm ghost" title="Branch conversation"><II.Branch /> Branch</button>
          <button className="btn sm ghost" title="New thread"><II.Plus /> New</button>
          <button className="btn sm ghost" title="Edit agent"><II.Edit /></button>
        </div>
      </div>

      <div className="chat-tabs">
        <button className={"chat-tab " + (tab === "chat" ? "on" : "")} onClick={() => setTab("chat")}>
          Conversation <span className="count">{messages.length}</span>
        </button>
        <button className={"chat-tab " + (tab === "config" ? "on" : "")} onClick={() => setTab("config")}>
          Configuration
        </button>
        <button className={"chat-tab " + (tab === "history" ? "on" : "")} onClick={() => setTab("history")}>
          History <span className="count">14</span>
        </button>
        <button className={"chat-tab " + (tab === "memory" ? "on" : "")} onClick={() => setTab("memory")}>
          Memory <span className="count">7</span>
        </button>
        <button className={"chat-tab " + (tab === "prompt" ? "on" : "")} onClick={() => setTab("prompt")}>
          System Prompt
        </button>
      </div>

      {tab === "chat" && (
        <>
          <div className="chat-scroll" ref={scrollRef}>
            {messages.length === 0 ? <ChatEmpty agent={agent} onPick={(t) => setInput(t)} /> : null}
            <div className="chat-thread">
              {messages.map((m, i) => (
                <Message key={i} m={m} agent={agent}
                  isLast={i === messages.length - 1}
                  streaming={i === messages.length - 1 && streaming} />
              ))}
            </div>
          </div>

          <div className="composer" style={{ position: "relative" }}>
            <div className="composer-inner" style={{ position: "relative" }}>
              {slashOpen && filteredSlash.length > 0 && (
                <div className="slash-popup">
                  {filteredSlash.map((s, i) => (
                    <div key={s.cmd}
                      className={"item " + (i === slashIdx ? "on" : "")}
                      onClick={() => { setInput(s.cmd + " "); setSlashOpen(false); textareaRef.current?.focus(); }}>
                      <span className="cmd">{s.cmd}</span>
                      <span className="desc">{s.desc}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="composer-box">
                {attachments.length > 0 && (
                  <div className="composer-attachments">
                    {attachments.map((a, i) => (
                      <span key={i} className="attach-chip">
                        <II.Folder /> {a}
                        <span className="x" onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}>
                          <II.X />
                        </span>
                      </span>
                    ))}
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={onInputChange}
                  onKeyDown={onKeyDown}
                  placeholder={`Message ${agent.short} - / for commands, @ to mention an agent`}
                  rows={1}
                />
                <div className="composer-bar">
                  <button className="btn sm ghost" title="Attach" onClick={() => setAttachments(a => [...a, "src/checkout/state.ts"])}>
                    <II.Attach />
                  </button>
                  <button className="btn sm ghost" title="Image"><II.Image /></button>
                  <button className="btn sm ghost" title="Slash commands" onClick={() => { setInput("/"); setSlashOpen(true); textareaRef.current?.focus(); }}>
                    <II.Slash />
                  </button>
                  <span className="chip">cwd: ~/proj</span>
                  <span className="chip">{agent.model}</span>
                  <div className="right">
                    {streaming ? (
                      <button className="btn sm" onClick={stopGen}><II.Stop /> Stop</button>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--txt-4)", fontFamily: "var(--font-mono)" }}>
                        <span className="kbd">⏎</span> send · <span className="kbd">⇧⏎</span> newline
                      </span>
                    )}
                    <button className="send-btn" onClick={send} disabled={!input.trim() && attachments.length === 0}>
                      <II.Send />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "config" && <ConfigTab agent={agent} />}
      {tab === "history" && <HistoryTab agent={agent} />}
      {tab === "memory" && <MemoryTab agent={agent} />}
      {tab === "prompt" && <PromptTab agent={agent} />}
    </div>
  );
}

function ChatEmpty({ agent, onPick }) {
  const sugs = [
    { lbl: "Plan", text: `Help me plan a ${agent.role === "implementer" ? "feature" : "task"} for this week.` },
    { lbl: "Review", text: "Look at the current branch and tell me what you'd change before I merge." },
    { lbl: "Inspect", text: "Read ./src and tell me how the code is organized." },
    { lbl: "Explain", text: "Explain how this system handles errors at the boundary." },
  ];
  return (
    <div className="thread-empty">
      <PxSprite agent={agent} size={64} action={agent.status === "working" ? "typing" : "idle"} />
      <div className="greet">
        <h2>Hi, I'm {agent.name}.</h2>
        <p>{agent.desc}</p>
      </div>
      <div className="sug-grid">
        {sugs.map(s => (
          <button key={s.lbl} className="sug" onClick={() => onPick(s.text)}>
            <div className="lbl">{s.lbl}</div>
            {s.text}
          </button>
        ))}
      </div>
    </div>
  );
}

function Message({ m, agent, isLast, streaming }) {
  if (m.role === "you") {
    return (
      <div className="msg you">
        <div className="mav you">JO</div>
        <div className="bub">
          <div className="who"><span className="nm">You</span> · <span>{m.t < 0 ? "earlier" : "just now"}</span></div>
          <div className="bubble-prose">{m.text || <i style={{opacity:.7}}>(attachments only)</i>}</div>
          {m.attachments && m.attachments.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {m.attachments.map((a, i) => (
                <span key={i} className="attach-chip"><II.Folder /> {a}</span>
              ))}
            </div>
          )}
          <div className="actions">
            <button><II.Edit /> Edit</button>
            <button><II.Copy /> Copy</button>
          </div>
        </div>
      </div>
    );
  }

  // agent message
  return (
    <div className="msg">
      <div className="mav"><PxSprite agent={agent} size={30} animate={false} action="idle" /></div>
      <div className="bub">
        <div className="who"><span className="nm">{agent.short}</span> · <span>{m.t < 0 ? "earlier" : "now"}</span></div>
        {(m.parts || []).map((p, i) => <PartRenderer key={i} p={p} />)}
        {streaming && (
          <div className="thinking-card">
            <div className="dots"><span /><span /><span /></div>
            <span>Working…</span>
          </div>
        )}
        <div className="mmeter">
          <span><b>2,184</b> in</span>
          <span><b>1,072</b> out</span>
          <span><b>$0.024</b></span>
          <span><b>4.8s</b></span>
        </div>
        <div className="actions">
          <button><II.Copy /> Copy</button>
          <button><II.Refresh /> Retry</button>
          <button><II.Branch /> Branch</button>
        </div>
      </div>
    </div>
  );
}

function PartRenderer({ p }) {
  const [open, setOpen] = React.useState(false);
  if (p.type === "text") {
    return <div className="bubble-prose">{renderMarkdownish(p.text)}</div>;
  }
  if (p.type === "thinking") {
    return (
      <div className="thinking-card">
        <span style={{ fontWeight: 600, color: "var(--txt-2)" }}>Thinking</span>
        <span>·</span>
        <span>{p.text}</span>
      </div>
    );
  }
  if (p.type === "tool") {
    return (
      <div className="tool-card">
        <div className="tc-h" onClick={() => setOpen(o => !o)}>
          <span style={{ color: "var(--acc)", display: "inline-flex" }}>
            <II.ChevronDown />
          </span>
          <span className="tc-name">{p.name}</span>
          <span className="tc-arg">{p.arg}</span>
          {p.note && <span className="tc-note">{p.note}</span>}
        </div>
        {open && p.body && (
          <pre className="tc-body" style={{ margin: 0 }}>{p.body}</pre>
        )}
      </div>
    );
  }
  if (p.type === "code") {
    return (
      <div className="code-block">
        <div className="head">
          <span>{p.title}</span>
          <span>·</span>
          <span>{p.lang}</span>
          <button className="cp" onClick={() => navigator.clipboard?.writeText(p.body)}>Copy</button>
        </div>
        <pre style={{ margin: 0 }}>{highlightTS(p.body)}</pre>
      </div>
    );
  }
  return null;
}

function renderMarkdownish(text) {
  // very light handling: **bold**, `code`, paragraph breaks
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((seg, i) => {
    if (seg.startsWith("**") && seg.endsWith("**")) return <b key={i}>{seg.slice(2,-2)}</b>;
    if (seg.startsWith("`") && seg.endsWith("`")) return <code key={i}>{seg.slice(1,-1)}</code>;
    return <React.Fragment key={i}>{seg}</React.Fragment>;
  });
}

function highlightTS(src) {
  // very tiny TS highlighter
  const tokens = [];
  const KW = new Set(["type","const","let","var","function","return","if","else","true","false","null","undefined","import","from","export","as","interface"]);
  let buf = "";
  let i = 0;
  const out = [];
  const push = (cls, text) => out.push(<span key={out.length} className={cls}>{text}</span>);
  while (i < src.length) {
    const c = src[i];
    if (c === "/" && src[i+1] === "/") {
      const end = src.indexOf("\n", i); const j = end < 0 ? src.length : end;
      push("hl-c", src.slice(i, j)); i = j; continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      const q = c; let j = i + 1;
      while (j < src.length && src[j] !== q) j++;
      push("hl-s", src.slice(i, j+1)); i = j + 1; continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_$]/.test(src[j])) j++;
      const word = src.slice(i, j);
      if (KW.has(word)) push("hl-k", word);
      else if (/^[A-Z]/.test(word)) push("hl-n", word);
      else if (src[j] === "(") push("hl-fn", word);
      else push("hl-i", word);
      i = j; continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i; while (j < src.length && /[0-9.]/.test(src[j])) j++;
      push("hl-n", src.slice(i, j)); i = j; continue;
    }
    out.push(src[i]); i++;
  }
  return out;
}

function mockResponses(agent, userText) {
  // Sketch a tool-using response
  const r = [];
  r.push({ type: "thinking", text: "Reading what you mentioned and scanning the relevant area." });
  r.push({ type: "tool", name: "Grep", arg: `"${userText.split(/\s+/).slice(0,3).join(" ") || "TODO"}" src/`, note: "12 matches across 4 files",
    body: "src/checkout/state.ts:14: // TODO: derive eligibility from cart\nsrc/api/orders.ts:88: // TODO: idempotency key\nsrc/components/CartLine.tsx:32: // TODO: a11y label\nsrc/store/session.ts:7: // TODO: rotate auth\n…" });
  r.push({ type: "tool", name: "Read", arg: "src/checkout/state.ts", note: "84 lines",
    body: "// (truncated)\nexport type CheckoutState = { ... }" });
  r.push({ type: "text", text: `Here's what I found and what I'd do next:\n\n**Observation.** The three TODOs in checkout are all about the same thing - eligibility is computed in three places. I'd consolidate to a single \`eligibility(state)\` selector.\n\n**Plan.**\n1. Add the selector to \`src/checkout/state.ts\`\n2. Replace the three call-sites\n3. Test the empty-cart and gift-card-only paths\n\nWant me to go ahead and make the change, or hand off to **Crafts** to implement?` });
  return r;
}

// ── Configuration / History / Memory / Prompt tabs ──

function ConfigTab({ agent }) {
  return (
    <div className="tab-pane">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, maxWidth: 920 }}>
        <div className="card">
          <div className="card-h"><span className="title">Identity</span></div>
          <div style={{ padding: 14, fontSize: 13, lineHeight: 1.7 }}>
            <Row k="Name" v={agent.name} />
            <Row k="ID" v={agent.id} mono />
            <Row k="Role" v={agent.role} />
            <Row k="Description" v={agent.desc} />
          </div>
        </div>
        <div className="card">
          <div className="card-h"><span className="title">Model & runtime</span></div>
          <div style={{ padding: 14, fontSize: 13, lineHeight: 1.7 }}>
            <Row k="Model" v={agent.model} mono />
            <Row k="Effort" v={agent.effort} mono />
            <Row k="Max output" v="8192 tokens" mono />
            <Row k="Temperature" v="0.7" mono />
            <Row k="Timeout" v="30 min" mono />
            <Row k="Budget" v="$5.00 per run · $50 daily" mono />
          </div>
        </div>
        <div className="card">
          <div className="card-h"><span className="title">Skills</span></div>
          <div style={{ padding: 14, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {agent.skills.map(s => <span key={s} className="tag skill">#{s}</span>)}
          </div>
        </div>
        <div className="card">
          <div className="card-h"><span className="title">Tools allowed</span></div>
          <div style={{ padding: 14, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {agent.tools.map(s => <span key={s} className="tag">{s}</span>)}
          </div>
        </div>
        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <div className="card-h"><span className="title">Permissions</span><span className="sub">workspace policy applies</span></div>
          <div style={{ padding: 14 }}>
            <PermissionRow label="Read repository files" state="allowed" />
            <PermissionRow label="Edit files" state={agent.tools.includes("Edit") || agent.tools.includes("Write") ? "allowed" : "denied"} />
            <PermissionRow label="Run bash commands" state={agent.tools.includes("Bash") ? "ask" : "denied"} note="will prompt for destructive commands" />
            <PermissionRow label="Open URLs (web)" state={agent.tools.includes("WebFetch") || agent.tools.includes("WebSearch") ? "allowed" : "denied"} />
            <PermissionRow label="Network egress" state="restricted" note="allowlist: api.github.com, pypi.org" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, mono }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, padding: "4px 0" }}>
      <div style={{ color: "var(--txt-3)", fontSize: 12 }}>{k}</div>
      <div style={{ fontFamily: mono ? "var(--font-mono)" : "inherit", fontSize: mono ? 12 : 13 }}>{v}</div>
    </div>
  );
}

function PermissionRow({ label, state, note }) {
  const colors = { allowed: "var(--done)", denied: "var(--error)", ask: "var(--queued)", restricted: "var(--thinking)" };
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "8px 0", borderBottom: "1px dashed var(--line)", gap: 12 }}>
      <span style={{ flex: 1, fontSize: 13 }}>{label}</span>
      {note && <span style={{ fontSize: 11, color: "var(--txt-3)", fontFamily: "var(--font-mono)" }}>{note}</span>}
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 11, padding: "2px 8px",
        borderRadius: 999, color: colors[state], background: "var(--bg-2)",
        textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600,
      }}>{state}</span>
    </div>
  );
}

function HistoryTab({ agent }) {
  const runs = React.useMemo(() => Array.from({ length: 14 }, (_, i) => ({
    id: `run_${(i+1).toString().padStart(3,'0')}`,
    title: ["Add idempotency key to /orders", "Audit billing for race conditions", "Wire dark theme into Button", "Localize /settings to es-MX", "Refactor checkout selectors", "Add tests for orderbook", "Fix focus order on /checkout"][i % 7],
    ts: Date.now() - i * 1000 * 60 * 60 * (1 + Math.random()*4),
    cost: (0.02 + Math.random()*0.6).toFixed(3),
    tokens: Math.round(1200 + Math.random() * 14000),
    duration: Math.round(8 + Math.random()*240) + "s",
    outcome: ["completed","completed","completed","completed","failed","completed","completed"][i % 7],
  })), [agent.id]);
  return (
    <div className="tab-pane">
      <div className="card">
        <div className="card-h">
          <span className="title">History</span>
          <span className="sub">last 30 days · 14 runs · $4.18 total</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button className="btn sm">Export</button>
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "var(--bg-2)", color: "var(--txt-3)" }}>
              <th style={th}>Run</th><th style={th}>Title</th><th style={th}>When</th>
              <th style={th}>Duration</th><th style={th}>Tokens</th><th style={th}>Cost</th>
              <th style={th}>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {runs.map(r => (
              <tr key={r.id} style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={tdMono}>{r.id}</td>
                <td style={td}>{r.title}</td>
                <td style={tdMono}>{window.v3Rel(r.ts)} ago</td>
                <td style={tdMono}>{r.duration}</td>
                <td style={tdMono}>{r.tokens.toLocaleString()}</td>
                <td style={tdMono}>${r.cost}</td>
                <td style={td}>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 11,
                    padding: "2px 8px", borderRadius: 999,
                    background: r.outcome === "completed" ? "rgba(14,132,32,0.10)" : "rgba(199,22,43,0.10)",
                    color: r.outcome === "completed" ? "var(--done)" : "var(--error)",
                    textTransform: "uppercase", letterSpacing: "0.05em",
                  }}>{r.outcome}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th = { textAlign: "left", padding: "10px 14px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 };
const td = { padding: "10px 14px", fontSize: 13 };
const tdMono = { ...td, fontFamily: "var(--font-mono)", fontSize: 12 };

function MemoryTab({ agent }) {
  const items = [
    { k: "preferences", v: "Prefers `pnpm` over `npm`; uses `vitest`. No JSDoc on private functions." },
    { k: "team_voice", v: "Conventional commits. PR titles in present tense, scope-prefixed (e.g. `checkout:`)." },
    { k: "tech_stack", v: "React 18 + TypeScript 5.4 + Vite. Tailwind 3.x. Drizzle + Postgres." },
    { k: "do_not_touch", v: "src/legacy/* is read-only; ask before touching." },
    { k: "naming", v: "Components PascalCase, hooks `useFooBar`, types suffixed with `Type` only when ambiguous." },
    { k: "recent_pr", v: "Last PR #3812 - split CartLine into CartLine + CartLineActions. Reviewer noted: 'good split, name the second one clearer next time.'" },
    { k: "deadline", v: "Checkout v2 ships Fri 28th. A11y audit must pass before merge." },
  ];
  return (
    <div className="tab-pane">
      <div className="card">
        <div className="card-h">
          <span className="title">Memory</span>
          <span className="sub">facts {agent.short} carries into every conversation</span>
          <div style={{ marginLeft: "auto" }}>
            <button className="btn sm primary"><II.Plus /> Add fact</button>
          </div>
        </div>
        <div style={{ padding: 4 }}>
          {items.map((it, i) => (
            <div key={i} style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", display: "grid", gridTemplateColumns: "140px 1fr auto", gap: 12, alignItems: "start" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--acc)" }}>{it.k}</span>
              <span style={{ fontSize: 13, lineHeight: 1.5, color: "var(--txt-2)" }}>{it.v}</span>
              <div style={{ display: "flex", gap: 4 }}>
                <button className="btn sm ghost"><II.Edit /></button>
                <button className="btn sm ghost"><II.X /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PromptTab({ agent }) {
  const prompt = `You are ${agent.name} (${agent.id}).

ROLE: ${agent.desc}

OPERATING PRINCIPLES
• Match the team's existing voice and conventions. Read before writing.
• Never invent context - if you don't know, say so or look it up.
• Prefer minimal, focused changes over sweeping rewrites.
• When uncertain, ask before acting.

SKILLS: ${agent.skills.join(", ")}
TOOLS:  ${agent.tools.join(", ")}

OUTPUT
• Keep status lines short (≤ 80 chars).
• Show diffs, not files, when reporting changes.
• Cite file paths as \`src/foo/bar.ts:42\`.`;
  return (
    <div className="tab-pane">
      <div className="card">
        <div className="card-h">
          <span className="title">System Prompt</span>
          <span className="sub">version 7 · saved 3h ago</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button className="btn sm"><II.Refresh /> Revert</button>
            <button className="btn sm primary"><II.Edit /> Edit</button>
          </div>
        </div>
        <pre style={{
          margin: 0, padding: 18,
          fontFamily: "var(--font-mono)", fontSize: 12.5, lineHeight: 1.6,
          color: "var(--txt)", background: "var(--bg-1)",
          whiteSpace: "pre-wrap", borderRadius: "0 0 14px 14px",
        }}>{prompt}</pre>
      </div>
    </div>
  );
}

Object.assign(window, { ChatPanel });
