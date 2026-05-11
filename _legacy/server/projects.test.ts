import { describe, expect, test, afterAll, beforeAll } from "bun:test";
import {
  existsSync, mkdirSync, rmSync, readdirSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";

import {
  PROJECTS_DIR,
  slugify,
  resolveSummonCwd,
  readProject,
  updateProject,
  deleteProject,
  listProjectSummaries,
  readProjectMemory,
  ensureDefaultProject,
  addInstance,
  patchInstance,
  removeInstance,
  findInstance,
} from "./projects";
import { scanProjects, readSettings, writeSettings, expandTilde } from "./settings";
import type { Project, AppSettings } from "../shared/types";

const TMP_ROOT = join(tmpdir(), `aox-test-${process.pid}`);
const SETTINGS_FILE = join(homedir(), ".claude", "agent-office-settings.json");
let originalSettings: AppSettings | null = null;

beforeAll(() => {
  originalSettings = readSettings();
  mkdirSync(TMP_ROOT, { recursive: true });
});

afterAll(() => {
  if (existsSync(TMP_ROOT)) rmSync(TMP_ROOT, { recursive: true, force: true });
  if (originalSettings) writeSettings(originalSettings);
  else if (existsSync(SETTINGS_FILE)) rmSync(SETTINGS_FILE);
  if (existsSync(PROJECTS_DIR)) {
    for (const d of readdirSync(PROJECTS_DIR)) {
      if (d.startsWith("aoxtest-")) {
        try { rmSync(join(PROJECTS_DIR, d), { recursive: true, force: true }); } catch {}
      }
    }
  }
});

function makeProjectDir(name: string): string {
  const p = join(TMP_ROOT, name);
  mkdirSync(p, { recursive: true });
  return p;
}

function setTestSettings(excluded: string[] = []) {
  writeSettings({ projectsRoot: TMP_ROOT, excluded, firstRunComplete: true });
}

// ─── slugify ─────────────────────────────────────────────────────────────

describe("slugify", () => {
  test("lowercases and dashes", () => {
    expect(slugify("My Project!")).toBe("my-project");
  });
  test("strips leading/trailing dashes", () => {
    expect(slugify("--hello world--")).toBe("hello-world");
  });
  test("falls back to 'project' on empty input", () => {
    expect(slugify("!!!")).toBe("project");
  });
  test("truncates at 60 chars and strips trailing dash after truncation", () => {
    // Each 'a-' is 2 chars; 35 of them = 70 chars. After slice(0,60) we'd end on
    // an 'a-' boundary that introduces a trailing dash — the strip must run AFTER slice.
    const result = slugify("a-".repeat(35));
    expect(result.length).toBeLessThanOrEqual(60);
    expect(result.endsWith("-")).toBe(false);
  });
  test("trims whitespace", () => {
    expect(slugify("   spaced   ")).toBe("spaced");
  });
});

// ─── resolveSummonCwd ────────────────────────────────────────────────────

describe("resolveSummonCwd", () => {
  function fakeProject(cwd?: string): Project {
    return { id: "p", meta: { name: "p", description: "", roster: [], cwd }, memory: "" };
  }
  test("project cwd is used when requested is empty/missing", () => {
    expect(resolveSummonCwd(undefined, fakeProject("/tmp"))).toBe("/tmp");
    expect(resolveSummonCwd("", fakeProject("/tmp"))).toBe("/tmp");
    expect(resolveSummonCwd("   ", fakeProject("/tmp"))).toBe("/tmp");
  });
  test("explicit requested wins over project cwd", () => {
    expect(resolveSummonCwd("/work", fakeProject("/tmp"))).toBe("/work");
  });
  test("returns undefined when neither set", () => {
    expect(resolveSummonCwd(undefined, fakeProject(undefined))).toBeUndefined();
    expect(resolveSummonCwd(undefined, null)).toBeUndefined();
  });
});

// ─── settings ─────────────────────────────────────────────────────────────

describe("settings module", () => {
  test("round-trip read/write", () => {
    setTestSettings(["node_modules"]);
    const back = readSettings();
    expect(back?.projectsRoot).toBe(TMP_ROOT);
    expect(back?.excluded).toEqual(["node_modules"]);
    expect(back?.firstRunComplete).toBe(true);
  });
  test("expandTilde expands ~", () => {
    expect(expandTilde("~/foo")).toBe(join(homedir(), "foo"));
    expect(expandTilde("/abs/path")).toBe("/abs/path");
    expect(expandTilde("~")).toBe(homedir());
  });
});

// ─── scanProjects ─────────────────────────────────────────────────────────

describe("scanProjects", () => {
  test("lists non-hidden, non-excluded subdirectories sorted by name", () => {
    makeProjectDir("alpha");
    makeProjectDir("beta");
    makeProjectDir("gamma");
    makeProjectDir(".hidden");
    makeProjectDir("node_modules");
    const out = scanProjects(TMP_ROOT, ["node_modules"]);
    const names = out.map(e => e.name);
    expect(names).toContain("alpha");
    expect(names).toContain("beta");
    expect(names).toContain("gamma");
    expect(names).not.toContain(".hidden");
    expect(names).not.toContain("node_modules");
    expect(names).toEqual([...names].sort());
  });
  test("returns empty when root does not exist", () => {
    expect(scanProjects("/no-such-path-zzz", [])).toEqual([]);
  });
  test("includeExcluded returns excluded entries with the flag set", () => {
    makeProjectDir("included-x");
    makeProjectDir("skip-me-x");
    const out = scanProjects(TMP_ROOT, ["skip-me-x"], true);
    const skipped = out.find(e => e.name === "skip-me-x");
    expect(skipped).toBeDefined();
    expect(skipped!.excluded).toBe(true);
  });
});

// ─── readProject / updateProject ──────────────────────────────────────────

describe("readProject / updateProject (metadata over scan)", () => {
  test("returns a Project for any scanned dir even without metadata file", () => {
    const dir = makeProjectDir("aoxtest-plain");
    setTestSettings();
    const p = readProject("aoxtest-plain");
    expect(p).not.toBeNull();
    expect(p!.meta.cwd).toBe(dir);
    expect(p!.meta.name).toBe("aoxtest-plain");
    expect(p!.meta.roster).toEqual([]);
    expect(p!.memory).toBe("");
  });

  test("writes + reads back roster and memory", () => {
    makeProjectDir("aoxtest-meta");
    setTestSettings();
    updateProject("aoxtest-meta", {
      meta: {
        description: "test",
        roster: [{ instanceId: "frontend-1", agentId: "frontend" }],
      },
      memory: "PROJECT_MEMORY_MARKER",
    });
    const back = readProject("aoxtest-meta");
    expect(back!.meta.roster).toEqual([{ instanceId: "frontend-1", agentId: "frontend" }]);
    expect(back!.meta.description).toBe("test");
    expect(back!.memory).toBe("PROJECT_MEMORY_MARKER");
    expect(readProjectMemory("aoxtest-meta")).toBe("PROJECT_MEMORY_MARKER");
  });

  test("readProject returns null when dir is not in scan", () => {
    setTestSettings();
    expect(readProject("does-not-exist-aox")).toBeNull();
  });

  test("deleteProject removes metadata only; user dir is untouched", () => {
    const dir = makeProjectDir("aoxtest-del");
    setTestSettings();
    updateProject("aoxtest-del", { memory: "x" });
    expect(deleteProject("aoxtest-del")).toBe(true);
    const back = readProject("aoxtest-del");
    expect(back).not.toBeNull();
    expect(back!.memory).toBe("");
    expect(existsSync(dir)).toBe(true);
  });
});

// ─── listProjectSummaries ─────────────────────────────────────────────────

describe("listProjectSummaries", () => {
  test("returns empty when settings are not configured", () => {
    if (existsSync(SETTINGS_FILE)) rmSync(SETTINGS_FILE);
    expect(listProjectSummaries()).toEqual([]);
  });

  test("returns one summary per scanned dir with instanceCount", () => {
    makeProjectDir("aoxtest-summA");
    makeProjectDir("aoxtest-summB");
    setTestSettings();
    const summaries = listProjectSummaries();
    const ids = summaries.map(s => s.id);
    expect(ids).toContain("aoxtest-summa");
    expect(ids).toContain("aoxtest-summb");
    for (const s of summaries) {
      expect(typeof s.instanceCount).toBe("number");
    }
  });

  test("instanceCount reflects roster length (zero by default)", () => {
    makeProjectDir("aoxtest-counts");
    setTestSettings();
    let summary = listProjectSummaries().find(s => s.id === "aoxtest-counts");
    expect(summary!.instanceCount).toBe(0);

    addInstance("aoxtest-counts", "frontend");
    addInstance("aoxtest-counts", "frontend");
    addInstance("aoxtest-counts", "backend");

    summary = listProjectSummaries().find(s => s.id === "aoxtest-counts");
    expect(summary!.instanceCount).toBe(3);
  });
});

// ─── Roster operations ───────────────────────────────────────────────────

describe("roster operations", () => {
  test("addInstance assigns unique instance ids per agentId", () => {
    makeProjectDir("aoxtest-roster");
    setTestSettings();

    const { instance: a } = addInstance("aoxtest-roster", "frontend");
    const { instance: b } = addInstance("aoxtest-roster", "frontend");
    const { instance: c } = addInstance("aoxtest-roster", "backend");

    expect(a.instanceId).toBe("frontend-1");
    expect(b.instanceId).toBe("frontend-2");
    expect(c.instanceId).toBe("backend-1");

    const back = readProject("aoxtest-roster");
    expect(back!.meta.roster.length).toBe(3);
  });

  test("patchInstance updates overrides and clears with empty string", () => {
    makeProjectDir("aoxtest-patch");
    setTestSettings();
    const { instance } = addInstance("aoxtest-patch", "frontend");

    patchInstance("aoxtest-patch", instance.instanceId, {
      label: "Senior Frontend",
      model: "sonnet",
      effort: "xhigh",
    });
    let back = readProject("aoxtest-patch");
    const i1 = back!.meta.roster[0];
    expect(i1.label).toBe("Senior Frontend");
    expect(i1.model).toBe("sonnet");
    expect(i1.effort).toBe("xhigh");

    // Empty string clears the override
    patchInstance("aoxtest-patch", instance.instanceId, { effort: "" });
    back = readProject("aoxtest-patch");
    expect(back!.meta.roster[0].effort).toBeUndefined();
    expect(back!.meta.roster[0].model).toBe("sonnet"); // others preserved
  });

  test("removeInstance removes and throws on unknown", () => {
    makeProjectDir("aoxtest-remove");
    setTestSettings();
    const { instance } = addInstance("aoxtest-remove", "qa");
    const after = removeInstance("aoxtest-remove", instance.instanceId);
    expect(after.meta.roster).toEqual([]);
    expect(() => removeInstance("aoxtest-remove", "no-such-id")).toThrow(/not found/i);
  });

  test("removeInstance wipes persisted runs for that instance", async () => {
    const { pushRun, getRuns, deleteRunsForInstance } = await import("./store");
    const UNIQUE_PID = `aoxtest-runwipe-${process.pid}-${Date.now()}`;
    makeProjectDir(UNIQUE_PID);
    setTestSettings();
    const { instance } = addInstance(UNIQUE_PID, "qa");

    pushRun({
      id: `r-mine-${UNIQUE_PID}`, agentId: "qa", agentName: "QA", ts: Date.now(),
      prompt: "x", status: "done", output: "ok",
      tokensIn: 0, tokensOut: 0, cost: 0, durMs: 1,
      model: "sonnet", effort: "high",
      projectId: UNIQUE_PID, instanceId: instance.instanceId,
    });
    pushRun({
      id: `r-other-${UNIQUE_PID}`, agentId: "qa", agentName: "QA", ts: Date.now(),
      prompt: "y", status: "done", output: "ok",
      tokensIn: 0, tokensOut: 0, cost: 0, durMs: 1,
      model: "sonnet", effort: "high",
      projectId: UNIQUE_PID, instanceId: "other-1",
    });

    // Filter to OUR runs only — the user's real log may contain other entries.
    const onlyMine = () => getRuns().filter(r => r.projectId === UNIQUE_PID);
    expect(onlyMine().length).toBe(2);

    removeInstance(UNIQUE_PID, instance.instanceId);

    const survivors = onlyMine();
    expect(survivors.length).toBe(1);
    expect(survivors[0].instanceId).toBe("other-1");

    // Clean up: don't leave our 'other-1' run in the user's log forever.
    deleteRunsForInstance(UNIQUE_PID, "other-1");
    expect(onlyMine().length).toBe(0);
  });

  test("findInstance lookup", () => {
    makeProjectDir("aoxtest-find");
    setTestSettings();
    const { instance } = addInstance("aoxtest-find", "frontend");
    const project = readProject("aoxtest-find")!;
    expect(findInstance(project, instance.instanceId)?.agentId).toBe("frontend");
    expect(findInstance(project, "nope")).toBeNull();
    expect(findInstance(null, instance.instanceId)).toBeNull();
    expect(findInstance(project, undefined)).toBeNull();
  });

  test("addInstance preserves init overrides", () => {
    makeProjectDir("aoxtest-init");
    setTestSettings();
    const { instance } = addInstance("aoxtest-init", "frontend", {
      label: "Frontend Lead",
      model: "opus",
    });
    expect(instance.label).toBe("Frontend Lead");
    expect(instance.model).toBe("opus");
    const back = readProject("aoxtest-init");
    expect(back!.meta.roster[0].label).toBe("Frontend Lead");
  });

  test("roster yaml round-trip drops unknown fields", () => {
    makeProjectDir("aoxtest-yaml");
    setTestSettings();
    // Try to inject a stray field; normalizeRoster should strip it
    updateProject("aoxtest-yaml", {
      meta: {
        roster: [{
          instanceId: "x-1",
          agentId: "x",
          // @ts-expect-error — testing normalization
          rogueField: "should-not-persist",
        }],
      },
    });
    const back = readProject("aoxtest-yaml");
    const i = back!.meta.roster[0] as unknown as Record<string, unknown>;
    expect(i.instanceId).toBe("x-1");
    expect(i.rogueField).toBeUndefined();
  });
});

// ─── Legacy ───────────────────────────────────────────────────────────────

describe("legacy ensureDefaultProject", () => {
  test("is now a no-op (returns null)", () => {
    expect(ensureDefaultProject(["a", "b"])).toBeNull();
  });
});
