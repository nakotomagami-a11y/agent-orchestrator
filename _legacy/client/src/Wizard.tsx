import { useEffect, useState } from "react";
import { Avatar, I } from "./Avatars";
import { TOOLS, ROOMS } from "./helpers";
import * as api from "./api";
import type { InstalledSkill, RegistrySkill, SkillUpdate } from "./types";

const WIZ_STEPS = [
  { k: "identity", title: "Identity", desc: "Name, description, where the file lives." },
  { k: "skills",   title: "Skills",   desc: "Real downloadable skills assigned to this agent." },
  { k: "tools",    title: "Tools",    desc: "Allowed tools + permission mode." },
  { k: "prompt",   title: "Prompt",   desc: "The system prompt body." },
  { k: "review",   title: "Review",   desc: "Confirm and write the .md file." },
] as const;

export interface WizardData {
  name: string;
  id: string;
  desc: string;
  skills: string[];
  tools: string[];
  pm: string;
  model: string;
  effort: string;
  body: string;
  room?: string;
}

export type WizardMode = "create" | "edit" | "clone";

const DEFAULT_DATA: WizardData = {
  name: "Pico",
  id: "pico",
  desc: "Tiny utility agent that does one small thing well.",
  skills: ["docs"],
  tools: ["Read", "Write"],
  pm: "default",
  model: "haiku",
  effort: "low",
  body: "# Pico\n\nYou are Pico — a tiny utility agent. Do one small thing well.\n\n## Workflow\n- Read the file or area in question\n- Make the smallest possible change\n- Confirm what you did in 1-2 lines\n",
};

interface WizardProps {
  onClose: () => void;
  onCreate: (data: WizardData, mode: WizardMode) => void;
  mode?: WizardMode;
  initial?: Partial<WizardData>;
}

export function Wizard({ onClose, onCreate, mode = "create", initial }: WizardProps) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>({ ...DEFAULT_DATA, ...initial });

  const set = <K extends keyof WizardData>(k: K, v: WizardData[K]) => setData(d => ({ ...d, [k]: v }));

  return (
    <div className="wizard-scrim" onClick={onClose}>
      <div className="wizard" onClick={e => e.stopPropagation()}>
        <div className="wizard-head">
          <h2>{mode === "edit" ? `Edit ${data.name}` : mode === "clone" ? `Clone ${data.name}` : "Create agent"}</h2>
          <div className="steps">
            {WIZ_STEPS.map((s, i) => (
              <span key={s.k} className={"step-pip " + (i === step ? "on" : i < step ? "done" : "")}>
                <span className="n">{i < step ? "✓" : i + 1}</span>
                {s.title}
              </span>
            ))}
          </div>
          <button className="x" onClick={onClose}>×</button>
        </div>

        <div className="wizard-body scroll">
          {step === 0 && <WizIdentity data={data} set={set} mode={mode} />}
          {step === 1 && <WizSkills data={data} set={set} />}
          {step === 2 && <WizTools data={data} set={set} />}
          {step === 3 && <WizPrompt data={data} set={set} />}
          {step === 4 && <WizReview data={data} />}
        </div>

        <div className="wizard-foot">
          <div className="mono" style={{ fontSize: 11, color: "var(--txt-3)" }}>
            step {step + 1} of {WIZ_STEPS.length} · {WIZ_STEPS[step].desc}
          </div>
          <div className="right">
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}>Back</button>}
            {step < WIZ_STEPS.length - 1 ? (
              <button className="btn primary" onClick={() => setStep(step + 1)}>Next <I.Chevron /></button>
            ) : (
              <button className="btn primary" onClick={() => onCreate(data, mode)}>
                <I.Check /> {mode === "edit" ? `Update ${data.id}.md` : `Write ${data.id}.md`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        {hint && <div className="mono" style={{ fontSize: 11, color: "var(--txt-3)" }}>{hint}</div>}
      </div>
      {children}
    </div>
  );
}

interface SubProps {
  data: WizardData;
  set: <K extends keyof WizardData>(k: K, v: WizardData[K]) => void;
}

function WizIdentity({ data, set, mode }: SubProps & { mode: WizardMode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <div>
        <FieldGroup label="Name" hint="display name">
          <input className="input" value={data.name} onChange={e => set("name", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="ID" hint={mode === "edit" ? "locked in edit mode" : "filename slug → ~/.claude/agents/{id}.md"}>
          <input className="input" value={data.id}
            disabled={mode === "edit"}
            style={mode === "edit" ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
            onChange={e => set("id", e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase())} />
        </FieldGroup>
        <FieldGroup label="Description" hint="2 lines, surfaced in the roster">
          <textarea className="prompt-input" style={{ minHeight: 84 }}
            value={data.desc} onChange={e => set("desc", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Defaults" hint="model + effort baseline">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <select className="select" value={data.model} onChange={e => set("model", e.target.value)}>
              <option value="haiku">Haiku 4.5</option>
              <option value="sonnet">Sonnet 4.6</option>
              <option value="opus">Opus 4.7</option>
            </select>
            <select className="select" value={data.effort} onChange={e => set("effort", e.target.value)}>
              <option value="low">low effort</option>
              <option value="medium">medium effort</option>
              <option value="high">high effort</option>
              <option value="xhigh">xhigh effort</option>
              <option value="max">max effort</option>
            </select>
          </div>
        </FieldGroup>
        <FieldGroup label="Office room" hint="cubicle assignment in floor-plan view">
          <select className="select" value={data.room ?? ""} onChange={e => set("room", e.target.value || undefined)}>
            <option value="">(auto from skills)</option>
            {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </FieldGroup>
      </div>
      <div>
        <div className="mono" style={{ fontSize: 10, color: "var(--txt-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Preview</div>
        <div className="card" style={{ padding: 14, gap: 10, display: "flex", flexDirection: "column" }}>
          <div className="row">
            <Avatar agent={{ id: data.id || "x", name: data.name, glyph: "◯" }} style="sprite" size={36} />
            <div>
              <div style={{ fontWeight: 600 }}>{data.name || "Untitled"}</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--txt-3)" }}>{data.id}.md</div>
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--txt-2)", lineHeight: 1.5 }}>{data.desc}</div>
        </div>
      </div>
    </div>
  );
}

function WizSkills({ data, set }: SubProps) {
  const [installed, setInstalled] = useState<InstalledSkill[]>([]);
  const [registry, setRegistry] = useState<RegistrySkill[] | null>(null);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [updates, setUpdates] = useState<SkillUpdate[]>([]);
  const [scanState, setScanState] = useState<"idle" | "scanning" | "done">("idle");
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.fetchInstalledSkills().then(setInstalled).catch(() => setInstalled([]));
  }, []);

  async function scanForUpdates() {
    setScanState("scanning");
    try {
      const list = await api.fetchSkillUpdates();
      setUpdates(list);
      setScanState("done");
    } catch (e) {
      console.error(e);
      setScanState("idle");
      alert("Update scan failed: " + String(e));
    }
  }

  async function runUpdate(name: string) {
    setUpdating(name);
    try {
      await api.updateSkill(name);
      setInstalled(await api.fetchInstalledSkills());
      setUpdates(updates.filter(u => u.name !== name));
    } catch (e) {
      alert("Update failed: " + String(e));
    } finally {
      setUpdating(null);
    }
  }

  const updatesByName = new Map(updates.map(u => [u.name, u]));

  function openBrowse() {
    setBrowseOpen(true);
    if (registry === null) {
      api.fetchSkillRegistry()
        .then(setRegistry)
        .catch(e => setRegistryError(String(e)));
    }
  }

  async function refreshRegistry() {
    setRegistryError(null);
    setRegistry(null);
    try {
      const fresh = await api.fetchSkillRegistry(true);
      setRegistry(fresh);
    } catch (e) {
      setRegistryError(String(e));
    }
  }

  async function install(entry: RegistrySkill) {
    setInstalling(entry.name);
    try {
      await api.installSkillEntry(entry);
      const list = await api.fetchInstalledSkills();
      setInstalled(list);
      setRegistry(r => r?.map(e => e.name === entry.name ? { ...e, installed: true } : e) ?? null);
    } catch (e) {
      alert("Install failed: " + String(e));
    } finally {
      setInstalling(null);
    }
  }

  async function uninstall(name: string) {
    if (!confirm(`Uninstall ${name}? This removes it from ~/.claude/agents/_skills/ and any agents that reference it will get nothing injected at summon time.`)) return;
    try {
      await api.uninstallSkill(name);
      setInstalled(await api.fetchInstalledSkills());
      setRegistry(r => r?.map(e => e.name === name ? { ...e, installed: false } : e) ?? null);
      set("skills", data.skills.filter(s => s !== name));
    } catch (e) {
      alert("Uninstall failed: " + String(e));
    }
  }

  const toggle = (name: string) => {
    const has = data.skills.includes(name);
    set("skills", has ? data.skills.filter(x => x !== name) : [...data.skills, name]);
  };

  const orphaned = data.skills.filter(s => !installed.some(i => i.name === s));

  const q = search.trim().toLowerCase();
  const visibleRegistry = registry
    ? registry.filter(e => {
        if (sourceFilter && e.source !== sourceFilter) return false;
        if (tagFilter.size > 0) {
          // skill must have *every* selected tag (intersection — narrows)
          for (const t of tagFilter) if (!e.tags.includes(t)) return false;
        }
        if (q) {
          return e.name.toLowerCase().includes(q)
            || (e.description ?? "").toLowerCase().includes(q)
            || e.tags.some(t => t.toLowerCase().includes(q));
        }
        return true;
      })
    : [];

  const registrySources = registry
    ? Array.from(new Set(registry.map(r => r.source))).sort()
    : [];

  // Tag counts within the currently-source-filtered set, so the chip numbers stay sensible
  const tagCounts: Array<[string, number]> = registry
    ? (() => {
        const counts: Record<string, number> = {};
        for (const e of registry) {
          if (sourceFilter && e.source !== sourceFilter) continue;
          for (const t of e.tags) counts[t] = (counts[t] ?? 0) + 1;
        }
        return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      })()
    : [];

  function toggleTag(t: string) {
    const next = new Set(tagFilter);
    if (next.has(t)) next.delete(t); else next.add(t);
    setTagFilter(next);
  }

  return (
    <div>
      <FieldGroup label="Installed skills" hint={`${installed.length} installed · ${data.skills.length} assigned to this agent${updates.length > 0 ? ` · ${updates.length} update${updates.length === 1 ? "" : "s"} available` : ""}`}>
        {installed.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
            <button
              className="btn ghost"
              style={{ height: 26, padding: "0 10px", fontSize: 12 }}
              onClick={scanForUpdates}
              disabled={scanState === "scanning"}
            >
              {scanState === "scanning" ? "scanning…" : "↻ scan for updates"}
            </button>
            {scanState === "done" && updates.length === 0 && (
              <span className="mono" style={{ fontSize: 11, color: "var(--done)" }}>
                ✓ everything up to date
              </span>
            )}
            {updates.length > 0 && (
              <span className="mono" style={{ fontSize: 11, color: "var(--working)" }}>
                ↑ {updates.length} update{updates.length === 1 ? "" : "s"} available
              </span>
            )}
          </div>
        )}
        {installed.length === 0 ? (
          <div style={{
            padding: 24, background: "var(--bg-1)", border: "1px dashed var(--line-strong)",
            borderRadius: 8, textAlign: "center", color: "var(--txt-3)",
          }}>
            <div style={{ marginBottom: 10 }}>No skills installed yet.</div>
            <button className="btn primary" onClick={openBrowse}>
              <I.Plus /> Browse skill registry
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {installed.map(s => {
              const isOn = data.skills.includes(s.name);
              const hasUpdate = updatesByName.has(s.name);
              const prov = s.provenance;
              return (
                <div key={s.name} style={{
                  display: "grid", gridTemplateColumns: "auto 1fr auto",
                  gap: 10, alignItems: "center",
                  padding: "10px 12px",
                  background: isOn ? "var(--acc-subtle)" : "var(--bg-1)",
                  border: "1px solid " + (hasUpdate ? "var(--working)" : isOn ? "var(--acc)" : "var(--line)"),
                  borderRadius: 8,
                }}>
                  <button
                    onClick={() => toggle(s.name)}
                    title={isOn ? "Unassign from this agent" : "Assign to this agent"}
                    style={{
                      width: 22, height: 22, borderRadius: 4,
                      background: isOn ? "var(--acc)" : "var(--bg-2)",
                      border: "1px solid " + (isOn ? "var(--acc)" : "var(--line-strong)"),
                      color: isOn ? "var(--acc-text)" : "transparent",
                      display: "grid", placeItems: "center", padding: 0,
                    }}>
                    {isOn && <I.Check style={{ width: 14, height: 14 }} />}
                  </button>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{s.name}</span>
                      {prov && (
                        <span className="mono" style={{
                          fontSize: 10, color: "var(--txt-3)",
                          padding: "1px 6px", background: "var(--bg-2)",
                          borderRadius: 3,
                        }} title={`installed ${prov.installedAt} from ${prov.path}@${prov.sha.slice(0, 7)}`}>
                          {prov.source}@{prov.ref}
                        </span>
                      )}
                      {hasUpdate && (
                        <span className="mono" style={{ fontSize: 10, color: "var(--working)" }}>
                          ● update available
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--txt-2)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2 }}>
                      {s.description || <span style={{ color: "var(--txt-3)" }}>(no description)</span>}
                    </div>
                    <div className="mono" style={{ fontSize: 10.5, color: "var(--txt-3)", marginTop: 2 }}>
                      {s.body.length.toLocaleString()} chars
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {hasUpdate && (
                      <button
                        className="btn primary"
                        style={{ height: 26, padding: "0 10px", fontSize: 11.5 }}
                        onClick={() => runUpdate(s.name)}
                        disabled={updating === s.name}
                        title="Re-download latest version">
                        {updating === s.name ? "…" : "↑ Update"}
                      </button>
                    )}
                    <button
                      className="btn ghost"
                      style={{ height: 26, padding: "0 8px", fontSize: 11.5 }}
                      onClick={() => uninstall(s.name)}
                      title="Uninstall (delete from disk)">
                      <I.Trash />
                    </button>
                  </div>
                </div>
              );
            })}
            <button className="btn ghost" onClick={openBrowse} style={{ alignSelf: "flex-start", marginTop: 4 }}>
              <I.Plus /> Install more skills
            </button>
          </div>
        )}
      </FieldGroup>

      {orphaned.length > 0 && (
        <FieldGroup label="Orphaned references" hint="these skills are in the agent's frontmatter but not installed — they inject nothing">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {orphaned.map(s => (
              <button key={s} className="chip" onClick={() => toggle(s)} title="Click to remove">
                {s} <I.X style={{ width: 9, height: 9, opacity: 0.7 }} />
              </button>
            ))}
          </div>
        </FieldGroup>
      )}

      {browseOpen && (
        <div style={{
          marginTop: 16, padding: 14,
          background: "var(--bg-1)", border: "1px solid var(--line-strong)",
          borderRadius: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Skill registry</div>
            <span className="mono" style={{ fontSize: 11, color: "var(--txt-3)" }}>
              {registry === null && !registryError ? "loading…" :
                registry ? `${registry.length} available · ${registry.filter(r => r.installed).length} installed` : ""}
            </span>
            <button className="btn ghost" style={{ height: 26, padding: "0 8px", fontSize: 11.5, marginLeft: "auto" }}
              onClick={refreshRegistry} title="Re-fetch from GitHub">
              ↻ refresh
            </button>
            <button className="btn ghost" style={{ height: 26, padding: "0 8px", fontSize: 11.5 }}
              onClick={() => setBrowseOpen(false)}>
              close
            </button>
          </div>

          {registry !== null && (
            <>
              <div className="search" style={{ marginBottom: 8 }}>
                <I.Search />
                <input
                  placeholder="Search skills…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && <button className="topbar-btn" style={{ height: 24, padding: "0 6px" }} onClick={() => setSearch("")}><I.X /></button>}
              </div>
              {registrySources.length > 1 && (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                  <span style={{ fontSize: 10, color: "var(--txt-3)", fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: "0.04em", alignSelf: "center", marginRight: 4 }}>source</span>
                  <button
                    className={"chip " + (sourceFilter === null ? "on" : "")}
                    onClick={() => setSourceFilter(null)}>
                    all <span className="n">{registry.length}</span>
                  </button>
                  {registrySources.map(src => {
                    const count = registry.filter(r => r.source === src).length;
                    return (
                      <button
                        key={src}
                        className={"chip " + (sourceFilter === src ? "on" : "")}
                        onClick={() => setSourceFilter(sourceFilter === src ? null : src)}
                        title={src}>
                        {src.split("/").pop()} <span className="n">{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {tagCounts.length > 0 && (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 10, color: "var(--txt-3)", fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: "0.04em", alignSelf: "center", marginRight: 4 }}>tags</span>
                  {tagCounts.map(([t, count]) => (
                    <button
                      key={t}
                      className={"chip " + (tagFilter.has(t) ? "on" : "")}
                      onClick={() => toggleTag(t)}
                      title={tagFilter.size > 0 ? "Narrows further (AND)" : "Filter by tag"}>
                      #{t} <span className="n">{count}</span>
                    </button>
                  ))}
                  {tagFilter.size > 0 && (
                    <button
                      className="topbar-btn"
                      style={{ height: 24, padding: "0 8px", fontSize: 11 }}
                      onClick={() => setTagFilter(new Set())}
                      title="Clear all tag filters">
                      clear
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {registryError && (
            <div style={{ fontSize: 12, color: "var(--error)", fontFamily: "var(--mono)", padding: "8px 0" }}>
              {registryError}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 380, overflowY: "auto" }} className="scroll">
            {visibleRegistry.map(entry => (
              <div key={entry.source + "/" + entry.name} style={{
                display: "grid", gridTemplateColumns: "1fr auto",
                gap: 10, alignItems: "center",
                padding: "10px 12px",
                background: "var(--bg-2)", border: "1px solid var(--line)",
                borderRadius: 6,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{entry.name}</span>
                    <span className="mono" style={{ fontSize: 10.5, color: "var(--txt-3)" }}>{entry.source}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--txt-2)", lineHeight: 1.4, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2 }}>
                    {entry.description}
                  </div>
                  {entry.tags.length > 0 && (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                      {entry.tags.slice(0, 8).map(t => (
                        <button
                          key={t}
                          onClick={(e) => { e.stopPropagation(); toggleTag(t); }}
                          className={"tag skill"}
                          style={{
                            cursor: "pointer", border: 0, fontSize: 10,
                            opacity: tagFilter.has(t) ? 1 : 0.75,
                            outline: tagFilter.has(t) ? "1px solid var(--acc)" : "none",
                          }}
                          title={tagFilter.has(t) ? `Tag filter active for #${t}` : `Filter by #${t}`}>
                          #{t}
                        </button>
                      ))}
                      {entry.tags.length > 8 && <span style={{ fontSize: 10, color: "var(--txt-3)", alignSelf: "center" }}>+{entry.tags.length - 8}</span>}
                    </div>
                  )}
                </div>
                {entry.installed ? (
                  <span className="status-pill done"><I.Check /> installed</span>
                ) : (
                  <button
                    className="btn primary"
                    style={{ height: 28, padding: "0 12px", fontSize: 12 }}
                    onClick={() => install(entry)}
                    disabled={installing === entry.name}>
                    {installing === entry.name ? "installing…" : <><I.Plus /> Install</>}
                  </button>
                )}
              </div>
            ))}
            {registry !== null && visibleRegistry.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--txt-3)", padding: 12, textAlign: "center" }}>
                No matches.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WizTools({ data, set }: SubProps) {
  const toggle = (t: string) => {
    const has = data.tools.includes(t);
    set("tools", has ? data.tools.filter(x => x !== t) : [...data.tools, t]);
  };
  return (
    <div>
      <FieldGroup label="Allowed tools" hint="explicit allow-list. Default-deny everything else.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
          {TOOLS.map(t => {
            const on = data.tools.includes(t);
            return (
              <button key={t}
                onClick={() => toggle(t)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 12px",
                  background: on ? "var(--acc-faint)" : "var(--bg-2)",
                  border: "1px solid " + (on ? "color-mix(in oklch, var(--acc) 50%, transparent)" : "var(--line)"),
                  borderRadius: 6, color: on ? "var(--acc)" : "var(--txt-1)",
                  fontFamily: "var(--mono)", fontSize: 12, textAlign: "left",
                }}>
                {on ? <I.Check /> : <span style={{ width: 14, display: "inline-block" }}></span>}
                {t}
              </button>
            );
          })}
        </div>
      </FieldGroup>
      <FieldGroup label="Permission mode" hint="how the agent gets approval to use tools">
        <div style={{ display: "flex", gap: 8 }}>
          {([
            ["default", "Default", "Standard prompts — claude asks before sensitive ops."],
            ["acceptEdits", "Auto-accept edits", "Edits go through without confirmation; other tools still prompt."],
            ["bypassPermissions", "Bypass all", "Never prompts. Trust the allow-list."],
            ["plan", "Plan-only", "Agent proposes; never executes."],
          ] as const).map(([k, t, d]) => (
            <button key={k} onClick={() => set("pm", k)} style={{
              flex: 1, textAlign: "left", padding: "12px 14px",
              background: data.pm === k ? "var(--acc-faint)" : "var(--bg-2)",
              border: "1px solid " + (data.pm === k ? "color-mix(in oklch, var(--acc) 50%, transparent)" : "var(--line)"),
              borderRadius: 6, cursor: "pointer",
            }}>
              <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 4, color: data.pm === k ? "var(--acc)" : "var(--txt)" }}>{t}</div>
              <div style={{ fontSize: 11.5, color: "var(--txt-2)" }}>{d}</div>
            </button>
          ))}
        </div>
      </FieldGroup>
    </div>
  );
}

function WizPrompt({ data, set }: SubProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, height: 460 }}>
      <div className="col" style={{ minHeight: 0 }}>
        <FieldGroup label="System prompt" hint="markdown body of the .md file">
          <textarea className="prompt-input scroll" style={{ minHeight: 380 }}
            value={data.body} onChange={e => set("body", e.target.value)} />
        </FieldGroup>
      </div>
      <div className="col" style={{ minHeight: 0 }}>
        <div className="mono" style={{ fontSize: 10, color: "var(--txt-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Live preview</div>
        <div className="card scroll" style={{ flex: 1, overflow: "auto" }}>
          <div style={{ padding: 16 }}>
            <pre style={{ margin: 0, fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--txt-1)" }}>{data.body}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function WizReview({ data }: { data: WizardData }) {
  const fileText = `---
name: ${data.name}
id: ${data.id}
description: ${data.desc}
default-model: ${data.model}
default-effort: ${data.effort}
skills: ${data.skills.join(", ")}
tools: ${data.tools.join(", ")}
permission-mode: ${data.pm}
---

${data.body}`;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 24 }}>
      <div>
        <FieldGroup label="Summary">
          <div className="card">
            <div style={{ padding: 14 }}>
              <div className="row" style={{ marginBottom: 10 }}>
                <Avatar agent={{ id: data.id, name: data.name, glyph: "◯" }} style="sprite" size={40} />
                <div>
                  <div style={{ fontWeight: 600 }}>{data.name}</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--txt-3)" }}>~/.claude/agents/{data.id}.md</div>
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--txt-2)", marginBottom: 12 }}>{data.desc}</div>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 12px", fontSize: 12 }}>
                <span className="mono muted">model</span><span className="mono">{data.model}/{data.effort}</span>
                <span className="mono muted">skills</span>
                <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {data.skills.map(s => <span key={s} className="tag skill">#{s}</span>)}
                </span>
                <span className="mono muted">tools</span>
                <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {data.tools.map(t => <span key={t} className="tag tool">{t}</span>)}
                </span>
                <span className="mono muted">perm-mode</span><span className="mono">{data.pm}</span>
              </div>
            </div>
          </div>
        </FieldGroup>
      </div>
      <div>
        <FieldGroup label="File contents" hint="markdown that will be written">
          <div className="card scroll" style={{ maxHeight: 380, overflow: "auto" }}>
            <pre style={{ margin: 0, padding: 16, fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--txt-1)" }}>{fileText}</pre>
          </div>
        </FieldGroup>
      </div>
    </div>
  );
}
