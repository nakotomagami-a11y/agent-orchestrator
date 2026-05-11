import { useEffect, useMemo, useRef, useState } from "react";
import { I, type AvatarStyle } from "./Avatars";
import {
  AgentHeader, Tabs, SummonPanel, HistoryTab, ConfigTab, PromptTab,
  type TabKey,
} from "./AgentDetail";
import { MemoryEditor } from "./MemoryEditor";
import { FloorPlan, FloorHeader, type Seat } from "./Floor";
import { ActivityDrawer, PipStrip } from "./Activity";
import { Wizard, type WizardData, type WizardMode } from "./Wizard";
import { GlobalMemoryModal } from "./GlobalMemoryModal";
import { TemplatesModal } from "./TemplatesModal";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { ProjectManageModal } from "./ProjectManageModal";
import { FirstRunWizard } from "./FirstRunWizard";
import { RosterModal } from "./RosterModal";
import { AgentPoolPicker } from "./AgentPoolPicker";
import type { TemplateEntry } from "./api";
import type { Project, ProjectSummary, AppSettings, AgentInstance } from "./types";

const LAST_PROJECT_KEY = "agent-office:current-project";
const NO_PROJECT_SENTINEL = "__none__";

import { glyphFor } from "./helpers";
import { useRunsState, rememberActive, forgetActive, loadActiveStubs } from "./runs";
import * as api from "./api";
import type { Agent, ApiAgent, HealthInfo, PersistedRun, Run } from "./types";

/**
 * Selection model:
 *   • Project active  → user picks an instance from the floor plan.    kind: "instance"
 *   • No project mode → user picks a global agent directly.            kind: "agent"
 *   • Nothing picked  → null (floor plan focus state).
 */
type Selection =
  | { kind: "instance"; instanceId: string; agentId: string }
  | { kind: "agent"; agentId: string }
  | null;

function seatIdFor(sel: Selection): string | null {
  if (!sel) return null;
  return sel.kind === "instance" ? `inst:${sel.instanceId}` : `agent:${sel.agentId}`;
}

function toAgent(a: ApiAgent, status: Agent["status"]): Agent {
  return {
    id: a.name,
    name: a.name.charAt(0).toUpperCase() + a.name.slice(1),
    glyph: glyphFor(a.name),
    desc: a.description,
    skills: a.skills,
    tools: a.tools,
    model: a.defaultModel ?? "sonnet",
    effort: a.defaultEffort ?? "medium",
    pm: a.permissionMode ?? "ask",
    room: a.room,
    status,
  };
}

/** Build a synthetic Agent for an instance, applying overrides on top of the base agent. */
function instanceAsAgent(base: Agent, inst: AgentInstance, status: Agent["status"]): Agent {
  return {
    ...base,
    id: base.id,        // underlying agent id (still the .md file)
    name: inst.label ?? base.name,
    model: inst.model ?? base.model,
    effort: inst.effort ?? base.effort,
    pm: inst.permissionMode ?? base.pm,
    room: inst.room ?? base.room,
    status,
  };
}

function persistedRunToRun(p: PersistedRun): Run {
  return {
    id: p.id, agentId: p.agentId, agentName: p.agentName, ts: p.ts,
    prompt: p.prompt, status: p.status,
    tokensIn: p.tokensIn, tokensOut: p.tokensOut, cost: p.cost,
    durMs: p.durMs, model: p.model, effort: p.effort,
    segments: [{ kind: "text", text: p.output }],
    cwd: p.cwd,
    projectId: p.projectId,
    instanceId: p.instanceId,
  };
}

export function App() {
  const [apiAgents, setApiAgents] = useState<ApiAgent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [serverRuns, setServerRuns] = useState<PersistedRun[]>([]);
  const [recentPrompts, setRecentPrompts] = useState<Record<string, string[]>>({});
  const [promptBodies, setPromptBodies] = useState<Record<string, string>>({});
  const [memoryDirty, setMemoryDirty] = useState<Record<string, boolean>>({});

  const [runsState, dispatch] = useRunsState();

  const [selection, setSelection] = useState<Selection>(null);
  const [tab, setTab] = useState<TabKey>("summon");
  const [activityOpen, setActivityOpen] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardMode, setWizardMode] = useState<WizardMode>("create");
  const [wizardInitial, setWizardInitial] = useState<Partial<WizardData> | undefined>(undefined);
  const [globalMemoryOpen, setGlobalMemoryOpen] = useState(false);
  const [globalMemoryDirty, setGlobalMemoryDirty] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [reconfigureOpen, setReconfigureOpen] = useState(false);
  const [activityShowAll, setActivityShowAll] = useState(false);
  const [rosterModalOpen, setRosterModalOpen] = useState(false);
  const [poolPickerOpen, setPoolPickerOpen] = useState(false);

  const wsRefs = useRef<Record<string, WebSocket>>({});

  // ─── Boot ───
  useEffect(() => {
    api.fetchAgents().then(setApiAgents).catch(e => setError(String(e)));
    api.fetchHealth().then(setHealth).catch(() => setHealth({ available: false, version: null, error: "fetch failed" }));
    api.fetchRuns(200).then(setServerRuns).catch(() => {});
    api.fetchAllRecentPrompts().then(setRecentPrompts).catch(() => {});

    api.fetchSettings().then(async (s) => {
      setSettings(s);
      setSettingsLoaded(true);
      if (!s) return;
      const summaries = await api.fetchProjects();
      setProjects(summaries);
      const last = (() => { try { return localStorage.getItem(LAST_PROJECT_KEY); } catch { return null; } })();
      if (last === NO_PROJECT_SENTINEL) return;
      const targetId = (last && summaries.some(p => p.id === last)) ? last : summaries[0]?.id;
      if (targetId) {
        const full = await api.fetchProject(targetId);
        if (full) setCurrentProject(full);
      }
    }).catch(() => setSettingsLoaded(true));

    const stubs = loadActiveStubs();
    for (const s of stubs) reattach(s);
  }, []);

  async function switchProject(id: string | null) {
    try {
      setSelection(null);  // any instance/agent selection from the prior context is now stale
      if (!id) {
        setCurrentProject(null);
        try { localStorage.setItem(LAST_PROJECT_KEY, NO_PROJECT_SENTINEL); } catch {}
        return;
      }
      const full = await api.fetchProject(id);
      if (!full) return;
      setCurrentProject(full);
      try { localStorage.setItem(LAST_PROJECT_KEY, id); } catch {}
    } catch (e) {
      alert("Switch failed: " + String(e));
    }
  }

  async function completeFirstRun(s: AppSettings) {
    setSettings(s);
    const summaries = await api.fetchProjects();
    setProjects(summaries);
    // Preserve no-project mode on reconfigure: don't clobber the sentinel.
    const storedSentinel = (() => {
      try { return localStorage.getItem(LAST_PROJECT_KEY) === NO_PROJECT_SENTINEL; }
      catch { return false; }
    })();
    if (storedSentinel) { setCurrentProject(null); return; }
    if (summaries[0]) {
      const full = await api.fetchProject(summaries[0].id);
      if (full) {
        setCurrentProject(full);
        try { localStorage.setItem(LAST_PROJECT_KEY, full.id); } catch {}
      }
    }
  }

  async function refreshCurrentProject() {
    if (!currentProject) return;
    const full = await api.fetchProject(currentProject.id);
    if (full) setCurrentProject(full);
    const summaries = await api.fetchProjects();
    setProjects(summaries);
  }

  // ⌘K (kept as a no-op until we add an in-floor search palette)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.querySelector<HTMLInputElement>(".search input")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ESC closes the agent detail modal — only when no other modal is on top.
  useEffect(() => {
    if (!selection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (wizardOpen || rosterModalOpen || poolPickerOpen || manageOpen
        || templatesOpen || globalMemoryOpen || reconfigureOpen) return;
      setSelection(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, wizardOpen, rosterModalOpen, poolPickerOpen, manageOpen,
    templatesOpen, globalMemoryOpen, reconfigureOpen]);

  // Lazy-load system prompt for the focused agent
  const focusAgentId =
    selection?.kind === "instance" ? selection.agentId :
    selection?.kind === "agent" ? selection.agentId : null;
  useEffect(() => {
    if (!focusAgentId || promptBodies[focusAgentId] !== undefined) return;
    api.fetchAgentBody(focusAgentId)
      .then(body => setPromptBodies(p => ({ ...p, [focusAgentId]: body })))
      .catch(() => {});
  }, [focusAgentId]);

  // Refresh recent prompts when a run finishes
  const liveRunsHash = Object.values(runsState.runs).map(r => r.id + r.status).join(",");
  useEffect(() => {
    api.fetchAllRecentPrompts().then(setRecentPrompts).catch(() => {});
  }, [liveRunsHash]);

  // ─── Derived ───
  const agents = useMemo<Agent[]>(() => {
    if (!apiAgents) return [];
    const runningByAgent = new Set(
      Object.values(runsState.runs).filter(r => r.status === "running").map(r => r.agentId),
    );
    return apiAgents.map(a => toAgent(a, runningByAgent.has(a.name) ? "working" : "idle"));
  }, [apiAgents, runsState.runs]);

  const agentById = useMemo<Record<string, Agent>>(() => {
    const out: Record<string, Agent> = {};
    for (const a of agents) out[a.id] = a;
    return out;
  }, [agents]);

  // History keyed by agent id (we'll filter further per selection in the detail view).
  const historyByAgent = useMemo<Record<string, Run[]>>(() => {
    const out: Record<string, Run[]> = {};
    for (const r of serverRuns) (out[r.agentId] ||= []).push(persistedRunToRun(r));
    return out;
  }, [serverRuns]);

  // Build the floor-plan seats from either the project roster or the global agent pool.
  const seats = useMemo<Seat[]>(() => {
    if (currentProject) {
      const runningInstances = new Set(
        Object.values(runsState.runs)
          .filter(r => r.status === "running" && r.instanceId)
          .map(r => r.instanceId as string),
      );
      return currentProject.meta.roster.map<Seat>(inst => {
        const base = agentById[inst.agentId];
        return {
          seatId: `inst:${inst.instanceId}`,
          agentId: inst.agentId,
          instanceId: inst.instanceId,
          label: inst.label ?? base?.name ?? inst.agentId,
          status: runningInstances.has(inst.instanceId) ? "working" : "idle",
          room: inst.room ?? base?.room,
          skills: base?.skills ?? [],
        };
      });
    }
    // No-project mode: every global agent is a free agent on the floor.
    return agents.map<Seat>(a => ({
      seatId: `agent:${a.id}`,
      agentId: a.id,
      label: a.name,
      status: a.status,
      room: a.room,
      skills: a.skills,
    }));
  }, [agents, agentById, currentProject, runsState.runs]);

  // Resolve the focused Agent shape for the right-hand detail panel
  const focusAgent: Agent | null = useMemo(() => {
    if (!selection) return null;
    const base = agentById[focusAgentId ?? ""];
    if (!base) return null;
    if (selection.kind === "instance") {
      const inst = currentProject?.meta.roster.find(i => i.instanceId === selection.instanceId);
      if (!inst) return null;
      const running = Object.values(runsState.runs)
        .some(r => r.status === "running" && r.instanceId === inst.instanceId);
      return instanceAsAgent(base, inst, running ? "working" : "idle");
    }
    return base;
  }, [selection, focusAgentId, agentById, currentProject, runsState.runs]);

  const focusRuns = useMemo<Run[]>(() => {
    if (!selection) return [];
    if (selection.kind === "instance") {
      return Object.values(runsState.runs)
        .filter(r => r.instanceId === selection.instanceId)
        .sort((a, b) => b.ts - a.ts);
    }
    // Agent (no-project) mode: only count direct summons (no instanceId)
    return Object.values(runsState.runs)
      .filter(r => r.agentId === selection.agentId && !r.instanceId)
      .sort((a, b) => b.ts - a.ts);
  }, [runsState.runs, selection]);

  const focusHistory = useMemo<Run[]>(() => {
    if (!selection) return [];
    const all = historyByAgent[selection.agentId] ?? [];
    if (selection.kind === "instance") {
      return all.filter(r => r.instanceId === selection.instanceId);
    }
    return all.filter(r => !r.instanceId);
  }, [historyByAgent, selection]);

  const selectedRunId = focusAgent ? runsState.selectedByAgent[focusAgent.id] ?? null : null;

  // ─── Selection handler from the floor plan ───
  function onSelectSeat(seatId: string) {
    if (focusAgent && memoryDirty[focusAgent.id]) {
      if (!confirm(`${focusAgent.name} has unsaved memory changes. Discard them?`)) return;
      setMemoryDirty(s => ({ ...s, [focusAgent.id]: false }));
    }
    if (seatId.startsWith("inst:")) {
      const instanceId = seatId.slice(5);
      const inst = currentProject?.meta.roster.find(i => i.instanceId === instanceId);
      if (!inst) return;
      setSelection({ kind: "instance", instanceId, agentId: inst.agentId });
    } else if (seatId.startsWith("agent:")) {
      const agentId = seatId.slice(6);
      setSelection({ kind: "agent", agentId });
    }
  }

  // ─── Summon ───
  function openWS(): WebSocket {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    return new WebSocket(`${proto}//${location.host}/api/summon`);
  }

  function attachWSEvents(ws: WebSocket, runId: string, onClose?: () => void) {
    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === "chunk") dispatch({ type: "chunk", runId, text: data.text });
        else if (data.type === "tool") dispatch({ type: "tool", runId, toolName: data.name, toolInput: data.input });
        else if (data.type === "usage") dispatch({ type: "usage", runId, tokensIn: data.tokensIn, tokensOut: data.tokensOut, cost: data.cost });
        else if (data.type === "done") {
          dispatch({ type: "status", runId, status: data.exitCode === 0 ? "done" : "error" });
          forgetActive(runId);
          ws.close();
          delete wsRefs.current[runId];
          api.fetchRuns(200).then(setServerRuns).catch(() => {});
          onClose?.();
        }
        else if (data.type === "error") dispatch({ type: "errorMessage", runId, message: data.message });
        else if (data.type === "attached") {
          dispatch({
            type: "attached", runId,
            output: data.output, tokensIn: data.tokensIn, tokensOut: data.tokensOut,
            cost: data.cost, status: data.status,
          });
        }
      } catch {}
    };
    ws.onerror = () => dispatch({ type: "status", runId, status: "error" });
  }

  function summon(opts: { model: string; effort: string; prompt: string; cwd: string }) {
    if (!selection || !focusAgent) return;
    if (health && !health.available) { alert("claude CLI is not available."); return; }
    const agentId = selection.agentId;
    const runId = `${agentId}-${Date.now()}-${Math.floor(Math.random() * 9999)}`;

    const newRun: Run = {
      id: runId, agentId, agentName: focusAgent.name, ts: Date.now(),
      prompt: opts.prompt, status: "running",
      tokensIn: 0, tokensOut: 0, cost: 0, durMs: 0, elapsedStr: "0s",
      model: opts.model === "default" ? focusAgent.model : opts.model,
      effort: opts.effort === "default" ? focusAgent.effort : opts.effort,
      segments: [], cwd: opts.cwd,
      projectId: currentProject?.id,
      instanceId: selection.kind === "instance" ? selection.instanceId : undefined,
    };
    dispatch({ type: "start", run: newRun });
    rememberActive({
      runId, agentId, agentName: focusAgent.name, ts: newRun.ts,
      prompt: opts.prompt, model: newRun.model, effort: newRun.effort, cwd: opts.cwd,
    });

    const ws = openWS();
    wsRefs.current[runId] = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "summon",
        runId, agent: agentId, prompt: opts.prompt,
        ...(opts.model !== "default" ? { model: opts.model } : {}),
        ...(opts.effort !== "default" ? { effort: opts.effort } : {}),
        ...(opts.cwd?.trim() ? { cwd: opts.cwd.trim() } : {}),
        ...(currentProject ? { projectId: currentProject.id } : {}),
        ...(selection.kind === "instance" ? { instanceId: selection.instanceId } : {}),
      }));
    };
    attachWSEvents(ws, runId);
  }

  function reattach(stub: { runId: string; agentId: string; agentName: string; ts: number; prompt: string; model: string; effort: string; cwd?: string }) {
    const placeholder: Run = {
      id: stub.runId, agentId: stub.agentId, agentName: stub.agentName,
      ts: stub.ts, prompt: stub.prompt, status: "running",
      tokensIn: 0, tokensOut: 0, cost: 0, durMs: Date.now() - stub.ts,
      model: stub.model, effort: stub.effort, segments: [], cwd: stub.cwd,
    };
    dispatch({ type: "start", run: placeholder });

    const ws = openWS();
    wsRefs.current[stub.runId] = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: "attach", runId: stub.runId }));
    attachWSEvents(ws, stub.runId, () => forgetActive(stub.runId));
  }

  function abortRun(runId: string) {
    const w = wsRefs.current[runId];
    if (w) { w.close(); delete wsRefs.current[runId]; }
    dispatch({ type: "status", runId, status: "done" });
    forgetActive(runId);
  }

  function closeRun(runId: string) {
    const w = wsRefs.current[runId];
    if (w) { w.close(); delete wsRefs.current[runId]; }
    dispatch({ type: "close", runId });
    forgetActive(runId);
  }

  function selectRun(agentId: string, runId: string | null) {
    dispatch({ type: "select", agentId, runId });
  }

  function openWizardCreate() { setWizardMode("create"); setWizardInitial(undefined); setWizardOpen(true); }
  function openWizardEdit(agent: Agent) {
    setWizardMode("edit");
    setWizardInitial({
      name: agent.name, id: agent.id, desc: agent.desc, skills: agent.skills,
      tools: agent.tools, pm: agent.pm, model: agent.model, effort: agent.effort,
      body: promptBodies[agent.id] ?? "", room: agent.room,
    });
    setWizardOpen(true);
  }
  function openWizardClone(agent: Agent) {
    setWizardMode("clone");
    setWizardInitial({
      name: agent.name + " copy", id: agent.id + "-copy", desc: agent.desc,
      skills: agent.skills, tools: agent.tools, pm: agent.pm,
      model: agent.model, effort: agent.effort,
      body: promptBodies[agent.id] ?? "", room: agent.room,
    });
    setWizardOpen(true);
  }

  async function saveAgent(data: WizardData, _mode: WizardMode) {
    try {
      await api.saveAgent(data, _mode);
      setApiAgents(await api.fetchAgents());
      setPromptBodies(p => { const n = { ...p }; delete n[data.id]; return n; });
      setWizardOpen(false);
    } catch (e) {
      alert("Failed to save agent: " + String(e));
    }
  }

  async function removeInstanceFromProject(instanceId: string, label: string) {
    if (!currentProject) return;
    if (!confirm(
      `Remove "${label}" from this project's roster?\n\n` +
      `This only removes the instance — the agent definition stays in your agents pool ` +
      `and is still available to other projects.`,
    )) return;
    try {
      await api.removeInstance(currentProject.id, instanceId);
      await refreshCurrentProject();
      setSelection(null);  // close detail modal; the seat is gone
    } catch (e) {
      alert("Remove failed: " + String(e));
    }
  }

  async function deleteAgent(agent: Agent) {
    if (!confirm(`Delete "${agent.name}"?\n\nRemoves ~/.claude/agents/${agent.id}.md and its memory file.\nHistorical runs in the log are preserved. Project roster references will keep pointing to the (now-missing) agent until you remove them.`)) return;
    try {
      await api.deleteAgent(agent.id);
      const fresh = await api.fetchAgents();
      setApiAgents(fresh);
      if (selection?.agentId === agent.id) setSelection(null);
      setPromptBodies(p => { const n = { ...p }; delete n[agent.id]; return n; });
    } catch (e) {
      alert("Delete failed: " + String(e));
    }
  }

  function applyTemplate(t: TemplateEntry) {
    setWizardMode("create");
    setWizardInitial({
      name: t.name, id: t.id, desc: t.desc,
      skills: t.skills, tools: t.tools, pm: t.pm,
      model: t.model, effort: t.effort, body: t.body, room: t.room,
    });
    setWizardOpen(true);
  }

  const runningCount = Object.values(runsState.runs).filter(r => r.status === "running").length;

  const activity = useMemo<Run[]>(() => {
    const live = Object.values(runsState.runs).sort((a, b) => b.ts - a.ts);
    const recent = serverRuns.slice(0, 60).map(persistedRunToRun);
    const all = [...live, ...recent];
    if (activityShowAll || !currentProject) return all.slice(0, 60);
    return all.filter(r => r.projectId === currentProject.id).slice(0, 60);
  }, [runsState.runs, serverRuns, currentProject, activityShowAll]);

  if (error) return <div style={{ padding: 32, color: "var(--error)", fontFamily: "var(--mono)" }}>Failed: {error}</div>;
  if (!apiAgents) return <div style={{ padding: 32, color: "var(--txt-3)", fontFamily: "var(--mono)" }}>Loading…</div>;

  const avatarStyle: AvatarStyle = "sprite";
  const showHealthBanner = health && !health.available;

  // Floor-plan empty states
  const emptyState = (() => {
    if (currentProject && currentProject.meta.roster.length === 0) {
      return {
        title: `${currentProject.meta.name} has no agents yet`,
        hint: "Click 'Add agent' to bring an agent into this project. You can add multiple instances of the same agent (e.g. two Frontends) — each gets its own desk and run history.",
        cta: { label: "Add agent", onClick: () => setPoolPickerOpen(true) },
      };
    }
    if (!currentProject && agents.length === 0) {
      return {
        title: "No agent definitions found",
        hint: "Create your first agent to start summoning. It will live under ~/.claude/agents/.",
        cta: { label: "Create agent", onClick: openWizardCreate },
      };
    }
    return undefined;
  })();

  const floorTitle = currentProject
    ? `${currentProject.meta.name} — Office`
    : "Office — Free agents";
  const floorSubtitle = currentProject
    ? "tap a desk · 'Add agent' to grow the roster"
    : "tap a desk to summon · pick a project to set up a roster";

  return (
    <div className="app" data-density="regular">
      <Topbar
        runningCount={runningCount}
        onToggleActivity={() => setActivityOpen(v => !v)}
        onOpenRoster={() => setRosterModalOpen(true)}
        rosterEnabled={!!currentProject}
        onAddAgent={() => setPoolPickerOpen(true)}
        addAgentEnabled={!!currentProject}
        onOpenMemory={() => setGlobalMemoryOpen(true)}
        onOpenTemplates={() => setTemplatesOpen(true)}
        projects={projects}
        currentProject={currentProject}
        onSwitchProject={switchProject}
        onManageProjects={() => setManageOpen(true)}
        onReconfigure={() => setReconfigureOpen(true)}
      />

      {showHealthBanner && (
        <div className="health-banner">
          <span>⚠</span>
          <span><b>claude</b> CLI not available — summons will fail. {health?.error}</span>
          <button className="topbar-btn" style={{ marginLeft: "auto", height: 24 }}
            onClick={() => api.fetchHealth().then(setHealth)}>recheck</button>
        </div>
      )}

      <div className={"app-body " + (activityOpen ? "with-activity" : "")}>
        <main className="main">
          <div style={{ display: "grid", gridTemplateRows: "auto 1fr", minHeight: 0 }}>
            <FloorHeader
              runningCount={runningCount}
              totalSeats={seats.length}
              title={floorTitle}
              subtitle={floorSubtitle}
            />
            <FloorPlan
              seats={seats}
              agentById={agentById}
              selectedSeatId={seatIdFor(selection)}
              onSelect={onSelectSeat}
              avatarStyle={avatarStyle}
              emptyState={emptyState}
              onAddAgent={currentProject ? () => setPoolPickerOpen(true) : undefined}
            />
          </div>
        </main>

        {activityOpen && (
          <ActivityDrawer
            items={activity}
            onClose={() => setActivityOpen(false)}
            onJump={(id) => {
              if (currentProject) {
                // Inside a project, only land on a seat that actually exists in the roster.
                // Falling back to {kind:"agent"} here would route summons through the
                // project context but skip every instance override — silently wrong.
                const inst = currentProject.meta.roster.find(i => i.agentId === id);
                if (inst) {
                  setSelection({ kind: "instance", instanceId: inst.instanceId, agentId: id });
                  setTab("summon");
                }
                return;
              }
              setSelection({ kind: "agent", agentId: id });
              setTab("summon");
            }}
            scopeLabel={currentProject?.meta.name}
            showAll={activityShowAll}
            onSetShowAll={setActivityShowAll}
          />
        )}
      </div>

      <div className="statusbar">
        <span><span className="statusdot working" style={{ display: "inline-block", verticalAlign: "middle", marginRight: 6 }}></span>{runningCount} running</span>
        <span className="sep">|</span>
        <span>{seats.length} {currentProject ? "instance" : "agent"}{seats.length === 1 ? "" : "s"}</span>
        <span className="sep">|</span>
        <PipStrip
          runs={Object.values(runsState.runs).filter(r => r.status === "running")}
          onJump={(agentId) => {
            if (currentProject) {
              const inst = currentProject.meta.roster.find(i => i.agentId === agentId);
              if (!inst) return;
              setSelection({ kind: "instance", instanceId: inst.instanceId, agentId });
            } else {
              setSelection({ kind: "agent", agentId });
            }
            setTab("summon");
            const targetRun = Object.values(runsState.runs).find(r => r.agentId === agentId && r.status === "running");
            if (targetRun) selectRun(agentId, targetRun.id);
          }}
          onDismiss={closeRun}
        />
        <span className="sep">|</span>
        <span>{health?.version ?? "claude unknown"}</span>
        <span className="sep">|</span>
        <span><span className="kbd">⌘↵</span> summon</span>
      </div>

      {wizardOpen && (
        <Wizard
          mode={wizardMode}
          initial={wizardInitial}
          onClose={() => { if (confirm("Close without saving?")) setWizardOpen(false); }}
          onCreate={saveAgent}
        />
      )}
      {globalMemoryOpen && (
        <GlobalMemoryModal
          onClose={() => {
            if (globalMemoryDirty && !confirm("Global memory has unsaved changes. Discard them?")) return;
            setGlobalMemoryOpen(false);
          }}
          onDirtyChange={setGlobalMemoryDirty}
        />
      )}
      {settingsLoaded && !settings && (
        <FirstRunWizard onComplete={completeFirstRun} />
      )}
      {reconfigureOpen && settings && (
        <FirstRunWizard
          initial={settings}
          onClose={() => setReconfigureOpen(false)}
          onComplete={async (s) => {
            setReconfigureOpen(false);
            await completeFirstRun(s);
          }}
        />
      )}
      {templatesOpen && (
        <TemplatesModal
          onClose={() => setTemplatesOpen(false)}
          onApplyToWizard={applyTemplate}
          onCreated={async () => {
            const fresh = await api.fetchAgents();
            setApiAgents(fresh);
          }}
          existingAgents={agents}
        />
      )}
      {manageOpen && (
        <ProjectManageModal
          projects={projects}
          currentProjectId={currentProject?.id ?? null}
          onClose={() => setManageOpen(false)}
          onChanged={async () => {
            const summaries = await api.fetchProjects();
            setProjects(summaries);
            // Preserve no-project mode if that's what the user is in.
            const storedSentinel = (() => {
              try { return localStorage.getItem(LAST_PROJECT_KEY) === NO_PROJECT_SENTINEL; }
              catch { return false; }
            })();
            if (storedSentinel) { setCurrentProject(null); return; }
            const targetId = (currentProject && summaries.some(p => p.id === currentProject.id))
              ? currentProject.id
              : summaries[0]?.id;
            if (targetId) {
              const fresh = await api.fetchProject(targetId);
              if (fresh) {
                setCurrentProject(fresh);
                try { localStorage.setItem(LAST_PROJECT_KEY, fresh.id); } catch {}
              }
            } else {
              setCurrentProject(null);
            }
          }}
          onSwitchTo={switchProject}
        />
      )}
      {currentProject && (
        <RosterModal
          open={rosterModalOpen}
          agents={agents}
          currentProject={currentProject}
          onClose={() => setRosterModalOpen(false)}
          onChanged={refreshCurrentProject}
          onAddAgent={() => { setRosterModalOpen(false); setPoolPickerOpen(true); }}
        />
      )}
      {poolPickerOpen && currentProject && (
        <AgentPoolPicker
          project={currentProject}
          agents={agents}
          onClose={() => setPoolPickerOpen(false)}
          onAdded={refreshCurrentProject}
          onNewAgent={() => { setPoolPickerOpen(false); setTemplatesOpen(true); }}
        />
      )}

      {focusAgent && selection && (
        <div className="wizard-scrim" onClick={() => setSelection(null)}>
          <div
            className="wizard"
            onClick={e => e.stopPropagation()}
            style={{
              width: "min(1100px, 95vw)",
              maxHeight: "90vh",
              gridTemplateRows: "auto auto auto 1fr",
            }}>
            <AgentHeader
              agent={focusAgent}
              avatarStyle={avatarStyle}
              onAbort={() => focusRuns.filter(r => r.status === "running").forEach(r => abortRun(r.id))}
              onEdit={() => {
                const base = agentById[selection.agentId];
                if (base) openWizardEdit(base);
              }}
              onClone={() => {
                const base = agentById[selection.agentId];
                if (base) openWizardClone(base);
              }}
              onDelete={() => {
                // Context-aware: in instance mode the trash removes this seat from the
                // current project ONLY. In agent (no-project) mode it deletes the global
                // definition — which is the same behaviour the no-project floor implies.
                if (selection.kind === "instance") {
                  removeInstanceFromProject(selection.instanceId, focusAgent.name);
                  return;
                }
                const base = agentById[selection.agentId];
                if (base) deleteAgent(base);
              }}
              deleteTitle={selection.kind === "instance"
                ? "Remove from this project (keeps the agent definition)"
                : "Delete agent definition"}
              onClose={() => setSelection(null)}
            />
            {selection.kind === "instance" && (
              <InstanceBanner
                instanceId={selection.instanceId}
                onEditOverrides={() => setRosterModalOpen(true)}
              />
            )}
            <Tabs active={tab} onChange={setTab} history={focusHistory} />
            <div className="tab-body scroll" style={{ padding: "16px 20px", overflow: "auto" }}>
              {tab === "summon" && (
                <SummonPanel
                  agent={focusAgent}
                  runs={focusRuns}
                  selectedRunId={selectedRunId}
                  recentPrompts={recentPrompts[selection.agentId] ?? []}
                  currentProject={currentProject}
                  onSelectRun={(id) => selectRun(focusAgent.id, id)}
                  onSummon={summon}
                  onAbortRun={abortRun}
                  onCloseRun={closeRun}
                />
              )}
              {tab === "history" && <HistoryTab runs={focusHistory} />}
              {tab === "config" && <ConfigTab agent={focusAgent} />}
              {tab === "memory" && (
                <MemoryScopeView
                  agent={focusAgent}
                  currentProject={currentProject}
                  onAgentDirty={(d) => setMemoryDirty(s => ({ ...s, [focusAgent.id]: d }))}
                />
              )}
              {tab === "prompt" && <PromptTab agent={focusAgent} body={promptBodies[selection.agentId] ?? null} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InstanceBanner({ instanceId, onEditOverrides }: { instanceId: string; onEditOverrides: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "6px 18px",
      background: "var(--bg-2)",
      borderBottom: "1px solid var(--line)",
      fontSize: 11, color: "var(--txt-3)", fontFamily: "var(--mono)",
    }}>
      <span>instance · {instanceId}</span>
      <span style={{ flex: 1 }} />
      <button className="topbar-btn" style={{ height: 24 }} onClick={onEditOverrides} title="Edit overrides for this instance">
        <I.Wrench /> Overrides
      </button>
    </div>
  );
}

type MemoryScope = "agent" | "project" | "global";

function MemoryScopeView({
  agent, currentProject, onAgentDirty,
}: {
  agent: Agent;
  currentProject: Project | null;
  onAgentDirty: (dirty: boolean) => void;
}) {
  const [scope, setScope] = useState<MemoryScope>("agent");
  const projectId = currentProject?.id;
  const projectName = currentProject?.meta.name;

  useEffect(() => {
    if (scope === "project" && !projectId) setScope("agent");
  }, [scope, projectId]);

  const tabBtn = (id: MemoryScope, label: string, disabled = false) => (
    <button
      key={id}
      disabled={disabled}
      onClick={() => setScope(id)}
      style={{
        background: scope === id ? "var(--bg-3)" : "transparent",
        border: 0,
        padding: "6px 12px",
        borderRadius: "var(--r-sm)",
        color: scope === id ? "var(--txt)" : disabled ? "var(--txt-3)" : "var(--txt-2)",
        fontSize: 12.5, fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}>{label}</button>
  );

  let editor: React.ReactNode = null;
  if (scope === "agent") {
    editor = (
      <MemoryEditor
        key={`agent:${agent.id}`}
        endpoint={`/api/agents/${encodeURIComponent(agent.id)}/memory`}
        title={`${agent.name} memory`}
        subtitle="persistent notes for this agent only"
        onDirtyChange={onAgentDirty}
        hint={<><I.Sparkles style={{ verticalAlign: "middle", marginRight: 6, color: "var(--acc)" }} />Auto-appended to <b>{agent.name}</b>'s system prompt at summon. Stored at <code style={{ color: "var(--txt-1)" }}>~/.claude/agents/{agent.id}.memory.md</code>.</>}
      />
    );
  } else if (scope === "project" && projectId) {
    editor = (
      <MemoryEditor
        key={`project:${projectId}`}
        endpoint={`/api/projects/${encodeURIComponent(projectId)}/memory`}
        title={`${projectName} project memory`}
        subtitle="applied to every agent summoned in this project"
        hint={<><I.Sparkles style={{ verticalAlign: "middle", marginRight: 6, color: "var(--acc)" }} />Auto-appended at summon time when any agent is summoned within <b>{projectName}</b>. Sits between global memory and per-agent memory in the system prompt.</>}
      />
    );
  } else if (scope === "global") {
    editor = (
      <MemoryEditor
        key="global"
        endpoint="/api/memory/global"
        title="Global memory"
        subtitle="applied to every agent in every project"
        hint={<><I.Sparkles style={{ verticalAlign: "middle", marginRight: 6, color: "var(--acc)" }} />Top of the memory composition order — every summon includes this. Use sparingly.</>}
      />
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 2,
        background: "var(--bg-1)", border: "1px solid var(--line)",
        borderRadius: "var(--r-md)", padding: 3,
        alignSelf: "flex-start",
      }}>
        {tabBtn("agent", "Agent")}
        {tabBtn("project", currentProject ? "Project" : "Project (none)", !currentProject)}
        {tabBtn("global", "Global")}
      </div>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {editor}
      </div>
    </div>
  );
}

function Topbar({
  runningCount, onToggleActivity, onOpenRoster, rosterEnabled, onAddAgent, addAgentEnabled,
  onOpenMemory, onOpenTemplates,
  projects, currentProject, onSwitchProject, onManageProjects, onReconfigure,
}: {
  runningCount: number;
  onToggleActivity: () => void;
  onOpenRoster: () => void;
  rosterEnabled: boolean;
  onAddAgent: () => void;
  addAgentEnabled: boolean;
  onOpenMemory: () => void;
  onOpenTemplates: () => void;
  projects: ProjectSummary[];
  currentProject: Project | null;
  onSwitchProject: (id: string | null) => void;
  onManageProjects: () => void;
  onReconfigure: () => void;
}) {
  return (
    <div className="topbar">
      <div className="topbar-brand">
        <div className="logo">A</div>
        Agent Office
      </div>
      <ProjectSwitcher
        projects={projects}
        current={currentProject}
        onSwitch={onSwitchProject}
        onManage={onManageProjects}
        onReconfigure={onReconfigure}
      />
      <button
        className="topbar-btn"
        onClick={onOpenRoster}
        disabled={!rosterEnabled}
        title={rosterEnabled
          ? "Edit this project's roster (add/remove instances, set overrides)"
          : "Pick a project first to manage its roster"}>
        <I.List /> Roster
      </button>
      <div className="topbar-spacer"></div>

      <div className="run-chip">
        <span className="pulse"></span>
        <span style={{ color: "var(--txt)" }}><b>{runningCount}</b></span>
        <span style={{ color: "var(--txt-3)" }}>running</span>
      </div>
      <button className="topbar-btn" onClick={onOpenTemplates} title="Browse curated agent templates">
        <I.Sparkles /> Templates
      </button>
      <button className="topbar-btn" onClick={onOpenMemory} title="Global memory">
        <I.Brain /> Memory
      </button>
      <button className="topbar-btn" onClick={onToggleActivity}>
        <I.Activity /> Activity
      </button>
      <button
        className="topbar-btn primary"
        onClick={onAddAgent}
        disabled={!addAgentEnabled}
        title={addAgentEnabled ? "Add an agent instance to this project" : "Pick a project first to add agents"}>
        <I.Plus /> Add agent
      </button>
    </div>
  );
}
