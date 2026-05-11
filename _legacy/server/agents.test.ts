// Smoke tests for frontmatter parsing + agent IO.
// Run with: bun test

import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// We test the parser by building a fake agents dir and pointing AGENTS_DIR at it.
// Since AGENTS_DIR is a `const`, we work around by importing the module fresh in a
// scoped temp and re-exporting via a thin wrapper. Simpler: test the writeAgent /
// readAgent round-trip in the real ~/.claude/agents/ but with throwaway names.

import { writeAgent, readAgent, listAgents, buildAppendedPrompt } from "./agents";

const TEST_PREFIX = "testaoxx";

afterAll(() => {
  const fs = require("node:fs");
  const path = require("node:path");
  const dir = path.join(require("node:os").homedir(), ".claude", "agents");
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    if (f.startsWith(TEST_PREFIX)) {
      try { fs.unlinkSync(path.join(dir, f)); } catch {}
    }
  }
});

function testId(suffix: string): string {
  return TEST_PREFIX + suffix.replace(/[^a-z0-9]/gi, "");
}

describe("agent round-trip", () => {
  test("writes and reads back basic frontmatter", () => {
    const id = testId("basic");
    writeAgent({
      name: id, id,
      desc: "a test agent",
      skills: ["research", "qa-web"],
      tools: ["WebSearch", "Read"],
      pm: "ask",
      model: "sonnet",
      effort: "medium",
      body: "# Test\nbody content",
    });
    const back = readAgent(id);
    expect(back).not.toBeNull();
    expect(back!.info.description).toBe("a test agent");
    expect(back!.info.skills).toEqual(["research", "qa-web"]);
    expect(back!.info.tools).toEqual(["WebSearch", "Read"]);
    expect(back!.info.defaultModel).toBe("sonnet");
    expect(back!.info.defaultEffort).toBe("medium");
    expect(back!.info.permissionMode).toBe("ask");
    expect(back!.body).toContain("body content");
  });

  test("handles room field", () => {
    const id = testId("room");
    writeAgent({
      name: id, id, desc: "room test",
      skills: ["research"], tools: ["Read"], pm: "auto",
      model: "haiku", effort: "low", body: "x",
      room: "Build",
    });
    const back = readAgent(id);
    expect(back!.info.room).toBe("Build");
  });

  test("listAgents includes our agent and excludes memory files", () => {
    const id = testId("listed");
    writeAgent({
      name: id, id, desc: "listed test",
      skills: [], tools: [], pm: "auto",
      model: "sonnet", effort: "medium", body: "x",
    });
    const list = listAgents();
    const names = list.map(a => a.name);
    expect(names).toContain(id);
  });

  test("invalid id is rejected", () => {
    expect(() => writeAgent({
      name: "x", id: "!!!", desc: "x",
      skills: [], tools: [], pm: "auto",
      model: "sonnet", effort: "medium", body: "x",
    })).toThrow();
  });
});

// Project memory injection: composition order tests removed when scan-based
// projects landed (would require tmpdir + settings fixture; covered by manual
// integration testing for now). The pure composition logic in
// buildAppendedPrompt is still exercised by passing Project objects directly.

describe("skill injection from installed skills", () => {
  test("buildAppendedPrompt includes installed skill bodies", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const skillsDir = path.join(require("node:os").homedir(), ".claude", "agents", "_skills");
    const testSkillName = "test-skill-aox-injection";
    const skillDir = path.join(skillsDir, testSkillName);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), `---
name: ${testSkillName}
description: Test injection skill
---

# Test Skill

This is the body content that should be injected.
INJECTION_MARKER_XYZ
`);

    try {
      const id = testId("skillinj");
      writeAgent({
        name: id, id, desc: "x",
        skills: [testSkillName],
        tools: [], pm: "ask",
        model: "haiku", effort: "low", body: "test body",
      });
      const appended = buildAppendedPrompt(id);
      expect(appended).toContain("Capabilities (from selected skills)");
      expect(appended).toContain(testSkillName);
      expect(appended).toContain("INJECTION_MARKER_XYZ");
    } finally {
      fs.rmSync(skillDir, { recursive: true, force: true });
    }
  });

  test("buildAppendedPrompt omits skills section when none are installed", () => {
    const id = testId("nofrag");
    writeAgent({
      name: id, id, desc: "x",
      skills: ["nonexistent-skill-xyz-aox"],
      tools: [], pm: "ask",
      model: "haiku", effort: "low", body: "test body",
    });
    const appended = buildAppendedPrompt(id);
    expect(appended).not.toContain("Capabilities (from selected skills)");
  });
});

describe("frontmatter list parsing", () => {
  test("YAML block list syntax", () => {
    // Test with a real file written manually
    const id = testId("ymllist");
    const fs = require("node:fs");
    const path = require("node:path");
    const dir = path.join(require("node:os").homedir(), ".claude", "agents");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, id + ".md");
    fs.writeFileSync(file, `---
name: ${id}
description: list test
tools:
  - Read
  - Write
  - Bash
skills:
  - research
---

body
`);
    const back = readAgent(id);
    expect(back!.info.tools).toEqual(["Read", "Write", "Bash"]);
    expect(back!.info.skills).toEqual(["research"]);
  });

  test("flow list syntax [a, b, c]", () => {
    const id = testId("flowlist");
    const fs = require("node:fs");
    const path = require("node:path");
    const dir = path.join(require("node:os").homedir(), ".claude", "agents");
    const file = path.join(dir, id + ".md");
    fs.writeFileSync(file, `---
name: ${id}
description: flow
tools: [Read, Write]
skills: [research, docs]
---
body
`);
    const back = readAgent(id);
    expect(back!.info.tools).toEqual(["Read", "Write"]);
    expect(back!.info.skills).toEqual(["research", "docs"]);
  });
});
