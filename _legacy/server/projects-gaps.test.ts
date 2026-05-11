/**
 * Gap-coverage tests for the scan-based + roster Projects model.
 * Covers behaviours not exercised by projects.test.ts:
 *   - scanProjects edge cases (file-not-dir root, slug collision, excluded flag)
 *   - parseMetadataFile paths (no frontmatter, YAML error, empty body, roster yaml)
 *   - createProjectMetadata error paths (no settings, excluded dir)
 *   - updateProject / deleteProjectMetadata edge cases
 *   - readSettings corruption / missing-key cases
 *   - resolveSummonCwd whitespace-only cwd
 *   - listProjectSummaries instanceCount
 *   - slugify additional cases (incl. the truncation-trailing-dash fix)
 */

import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import {
  existsSync, mkdirSync, rmSync, writeFileSync, readdirSync,
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
  deleteProjectMetadata,
  listProjectSummaries,
  createProjectMetadata,
  addInstance,
} from "./projects";
import { scanProjects, readSettings, writeSettings, expandTilde } from "./settings";
import type { Project, AppSettings } from "../shared/types";

const TMP_ROOT = join(tmpdir(), `aox-gaps-${process.pid}`);
const SETTINGS_FILE = join(homedir(), ".claude", "agent-office-settings.json");
let savedSettings: AppSettings | null = null;

beforeAll(() => {
  savedSettings = readSettings();
  mkdirSync(TMP_ROOT, { recursive: true });
});

afterAll(() => {
  if (existsSync(TMP_ROOT)) rmSync(TMP_ROOT, { recursive: true, force: true });
  if (savedSettings) writeSettings(savedSettings);
  else if (existsSync(SETTINGS_FILE)) rmSync(SETTINGS_FILE);
  if (existsSync(PROJECTS_DIR)) {
    for (const d of readdirSync(PROJECTS_DIR)) {
      if (d.startsWith("aoxgap-")) {
        try { rmSync(join(PROJECTS_DIR, d), { recursive: true, force: true }); } catch {}
      }
    }
  }
});

function makeDir(name: string): string {
  const p = join(TMP_ROOT, name);
  mkdirSync(p, { recursive: true });
  return p;
}

function useTestSettings(excluded: string[] = []) {
  writeSettings({ projectsRoot: TMP_ROOT, excluded, firstRunComplete: true });
}

function clearSettings() {
  if (existsSync(SETTINGS_FILE)) rmSync(SETTINGS_FILE);
}

// ─── scanProjects edge cases ─────────────────────────────────────────────

describe("scanProjects — edge cases", () => {
  test("returns [] when root path is a file, not a directory", () => {
    const tmp = join(TMP_ROOT, "_a-file.txt");
    writeFileSync(tmp, "contents");
    expect(scanProjects(tmp, [])).toEqual([]);
  });

  test("non-directory entries (files) inside root are skipped", () => {
    makeDir("aoxgap-with-file");
    writeFileSync(join(TMP_ROOT, "readme.md"), "text");
    const names = scanProjects(TMP_ROOT, []).map(e => e.name);
    expect(names).not.toContain("readme.md");
  });

  test("slug collision: two dirs that map to the same slug both appear in scan output", () => {
    makeDir("My-Dupe");
    makeDir("my-dupe");
    const out = scanProjects(TMP_ROOT, []);
    const dupes = out.map(e => e.id).filter(id => id === "my-dupe");
    expect(dupes.length).toBeGreaterThanOrEqual(2);
  });

  test("non-excluded entries have excluded: false in output", () => {
    makeDir("aoxgap-notexcluded");
    const out = scanProjects(TMP_ROOT, ["something-else"]);
    const entry = out.find(e => e.name === "aoxgap-notexcluded");
    expect(entry!.excluded).toBe(false);
  });

  test("excluded entry has excluded: true when includeExcluded=true", () => {
    makeDir("aoxgap-excl-flag");
    const out = scanProjects(TMP_ROOT, ["aoxgap-excl-flag"], true);
    expect(out.find(e => e.name === "aoxgap-excl-flag")!.excluded).toBe(true);
  });

  test("returns [] when root is an empty string", () => {
    expect(scanProjects("", [])).toEqual([]);
  });

  test("tilde is expanded in root path", () => {
    expect(scanProjects("~/nonexistent-aoxgap-xyz", [])).toEqual([]);
  });
});

// ─── metadata file parsing ───────────────────────────────────────────────

describe("project metadata file parsing", () => {
  test("file with no --- treats entire content as memory", () => {
    makeDir("aoxgap-nometa");
    useTestSettings();
    const metaDir = join(PROJECTS_DIR, "aoxgap-nometa");
    mkdirSync(metaDir, { recursive: true });
    writeFileSync(join(metaDir, "project.md"), "Just raw memory text here.\nLine 2.");
    const p = readProject("aoxgap-nometa");
    expect(p!.meta.name).toBe("aoxgap-nometa");
    expect(p!.meta.roster).toEqual([]);
    expect(p!.memory).toContain("Just raw memory text here.");
  });

  test("invalid YAML in frontmatter falls back to empty meta + memory preserved", () => {
    makeDir("aoxgap-badyaml");
    useTestSettings();
    const metaDir = join(PROJECTS_DIR, "aoxgap-badyaml");
    mkdirSync(metaDir, { recursive: true });
    writeFileSync(join(metaDir, "project.md"),
      "---\n: bad: yaml: { unclosed\n---\n\nsome memory\n");
    const p = readProject("aoxgap-badyaml");
    expect(p!.meta.name).toBe("aoxgap-badyaml");
    expect(p!.memory).toContain("some memory");
  });

  test("frontmatter without body yields empty memory string", () => {
    makeDir("aoxgap-nomem");
    useTestSettings();
    const metaDir = join(PROJECTS_DIR, "aoxgap-nomem");
    mkdirSync(metaDir, { recursive: true });
    writeFileSync(join(metaDir, "project.md"),
      "---\nname: Custom Name\ndescription: desc here\n---\n");
    const p = readProject("aoxgap-nomem");
    expect(p!.meta.name).toBe("Custom Name");
    expect(p!.meta.description).toBe("desc here");
    expect(p!.memory).toBe("");
  });

  test("roster list in frontmatter is parsed correctly", () => {
    makeDir("aoxgap-rosterlist");
    useTestSettings();
    const metaDir = join(PROJECTS_DIR, "aoxgap-rosterlist");
    mkdirSync(metaDir, { recursive: true });
    writeFileSync(join(metaDir, "project.md"),
      "---\nroster:\n  - instanceId: coder-1\n    agentId: coder\n  - instanceId: rev-1\n    agentId: reviewer\n    model: sonnet\n---\n\nproject context\n");
    const p = readProject("aoxgap-rosterlist");
    expect(p!.meta.roster.length).toBe(2);
    expect(p!.meta.roster[0]).toEqual({ instanceId: "coder-1", agentId: "coder" });
    expect(p!.meta.roster[1]).toEqual({ instanceId: "rev-1", agentId: "reviewer", model: "sonnet" });
    expect(p!.memory).toBe("project context");
  });

  test("malformed roster entries (missing required fields) are dropped", () => {
    makeDir("aoxgap-rosterbad");
    useTestSettings();
    const metaDir = join(PROJECTS_DIR, "aoxgap-rosterbad");
    mkdirSync(metaDir, { recursive: true });
    writeFileSync(join(metaDir, "project.md"),
      "---\nroster:\n  - instanceId: only-id\n  - agentId: only-agent\n  - instanceId: good-1\n    agentId: good\n---\n");
    const p = readProject("aoxgap-rosterbad");
    expect(p!.meta.roster.length).toBe(1);
    expect(p!.meta.roster[0].instanceId).toBe("good-1");
  });
});

// ─── createProjectMetadata error paths ───────────────────────────────────

describe("createProjectMetadata — error paths", () => {
  test("throws when settings are not configured", () => {
    clearSettings();
    expect(() => createProjectMetadata({ name: "whatever" }))
      .toThrow("first-run setup not complete");
  });

  test("throws when named folder is excluded from the scan", () => {
    makeDir("aoxgap-excl-create");
    writeSettings({ projectsRoot: TMP_ROOT, excluded: ["aoxgap-excl-create"], firstRunComplete: true });
    expect(() => createProjectMetadata({ name: "aoxgap-excl-create", id: "aoxgap-excl-create" }))
      .toThrow(/no folder matching id/);
  });

  test("throws when no folder on disk matches the derived slug", () => {
    useTestSettings();
    expect(() => createProjectMetadata({ name: "zzz-no-such-dir-aoxgap" }))
      .toThrow(/no folder matching id/);
  });

  test("succeeds and returns Project for a folder that exists in scan", () => {
    const dir = makeDir("aoxgap-create-ok");
    useTestSettings();
    const p = createProjectMetadata({ name: "aoxgap-create-ok", description: "hello" });
    expect(p.id).toBe("aoxgap-create-ok");
    expect(p.meta.cwd).toBe(dir);
    expect(p.meta.description).toBe("hello");
    expect(p.memory).toBe("");
  });
});

// ─── updateProject ─────────────────────────────────────────────────────

describe("updateProject — error paths", () => {
  test("throws 'not found' when id is absent from scan", () => {
    useTestSettings();
    expect(() => updateProject("zzz-no-such-dir-aoxgap", { memory: "x" }))
      .toThrow(/not found/);
  });
});

// ─── deleteProjectMetadata ───────────────────────────────────────────────

describe("deleteProjectMetadata", () => {
  test("returns false when metadata directory does not exist", () => {
    expect(deleteProjectMetadata("zzz-never-created-aoxgap")).toBe(false);
  });

  test("deleteProject alias behaves identically", () => {
    makeDir("aoxgap-alias-del");
    useTestSettings();
    updateProject("aoxgap-alias-del", { memory: "x" });
    expect(deleteProject("aoxgap-alias-del")).toBe(true);
    expect(deleteProject("aoxgap-alias-del")).toBe(false);
  });
});

// ─── readSettings resilience ─────────────────────────────────────────────

describe("readSettings — resilience", () => {
  test("returns null on invalid JSON", () => {
    writeFileSync(SETTINGS_FILE, "{ not valid json ]]");
    expect(readSettings()).toBeNull();
    useTestSettings();
  });

  test("returns null when projectsRoot is missing", () => {
    writeFileSync(SETTINGS_FILE, JSON.stringify({ excluded: [], firstRunComplete: true }));
    expect(readSettings()).toBeNull();
    useTestSettings();
  });

  test("returns null when projectsRoot is not a string", () => {
    writeFileSync(SETTINGS_FILE, JSON.stringify({ projectsRoot: 42, excluded: [], firstRunComplete: true }));
    expect(readSettings()).toBeNull();
    useTestSettings();
  });

  test("excluded field defaults to [] when missing", () => {
    writeFileSync(SETTINGS_FILE, JSON.stringify({ projectsRoot: TMP_ROOT, firstRunComplete: true }));
    expect(readSettings()!.excluded).toEqual([]);
    useTestSettings();
  });

  test("excluded entries that are not strings are filtered out", () => {
    writeFileSync(SETTINGS_FILE,
      JSON.stringify({ projectsRoot: TMP_ROOT, excluded: ["ok", 42, null, "also-ok"], firstRunComplete: true }));
    expect(readSettings()!.excluded).toEqual(["ok", "also-ok"]);
    useTestSettings();
  });

  test("firstRunComplete defaults to false when absent", () => {
    writeFileSync(SETTINGS_FILE, JSON.stringify({ projectsRoot: TMP_ROOT, excluded: [] }));
    expect(readSettings()!.firstRunComplete).toBe(false);
    useTestSettings();
  });
});

// ─── resolveSummonCwd whitespace ─────────────────────────────────────────

describe("resolveSummonCwd — whitespace-only values", () => {
  function fakeProject(cwd?: string): Project {
    return { id: "p", meta: { name: "p", description: "", roster: [], cwd }, memory: "" };
  }
  test("whitespace-only project cwd → undefined", () => {
    expect(resolveSummonCwd(undefined, fakeProject("   "))).toBeUndefined();
  });
  test("whitespace-only requested cwd loses to project cwd", () => {
    expect(resolveSummonCwd("  ", fakeProject("/tmp"))).toBe("/tmp");
  });
  test("null project with whitespace requested → undefined", () => {
    expect(resolveSummonCwd("   ", null)).toBeUndefined();
  });
});

// ─── listProjectSummaries instanceCount ──────────────────────────────────

describe("listProjectSummaries — instanceCount", () => {
  test("zero by default; grows with addInstance", () => {
    makeDir("aoxgap-counts");
    useTestSettings();
    let s = listProjectSummaries().find(p => p.id === "aoxgap-counts");
    expect(s!.instanceCount).toBe(0);
    addInstance("aoxgap-counts", "x");
    addInstance("aoxgap-counts", "y");
    s = listProjectSummaries().find(p => p.id === "aoxgap-counts");
    expect(s!.instanceCount).toBe(2);
  });
});

// ─── slugify ─────────────────────────────────────────────────────────────

describe("slugify — additional cases", () => {
  test("preserves existing hyphens", () => {
    expect(slugify("my-project")).toBe("my-project");
  });
  test("collapses runs of special chars into a single dash", () => {
    expect(slugify("foo   bar")).toBe("foo-bar");
    expect(slugify("foo___bar")).toBe("foo-bar");
  });
  test("non-ascii letters are replaced", () => {
    expect(slugify("café")).toBe("caf");
  });
  test("60-char name passes through unchanged", () => {
    const name = "a".repeat(60);
    expect(slugify(name)).toBe("a".repeat(60));
  });
  test("name longer than 60 chars is truncated to <= 60", () => {
    expect(slugify("a-".repeat(35)).length).toBeLessThanOrEqual(60);
  });
  test("trailing dash after truncation is stripped (regression for QA finding)", () => {
    // "a-".repeat(35) = 70 chars. Naive impl would slice at hyphen and leave trailing "-".
    expect(slugify("a-".repeat(35)).endsWith("-")).toBe(false);
  });
});

// ─── expandTilde ─────────────────────────────────────────────────────────

describe("expandTilde", () => {
  test("does not expand ~ in the middle of a path", () => {
    expect(expandTilde("/foo/~/bar")).toBe("/foo/~/bar");
  });
  test("does not expand ~ after a word character", () => {
    expect(expandTilde("foo~bar")).toBe("foo~bar");
  });
  test("expands ~/subdir correctly", () => {
    const result = expandTilde("~/subdir");
    expect(result).toBe(join(homedir(), "subdir"));
  });
});
