// Skill registry + install + update.
//
// Skills live at ~/.claude/agents/_skills/<name>/SKILL.md (app-managed, not
// Claude Code's global ~/.claude/skills/). Provenance recorded in
// <name>/.source.json so we can detect remote updates.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  RegistrySkill,
  InstalledSkill,
  SkillProvenance,
  SkillUpdate,
} from "../types/index";
import { ensureDir, writeFileAtomic } from "./fs-atomic";
import { SKILLS_DIR } from "./paths";
import { log } from "./log";
import { parseYaml } from "./yaml";

const REGISTRY_CACHE = join(SKILLS_DIR, "_registry.json");
const CACHE_TTL_MS = 60 * 60 * 1000;

const REGISTRY_SOURCES = [
  { source: "anthropics/skills", ref: "main" },
  { source: "tradermonty/claude-trading-skills", ref: "main" },
  { source: "Orchestra-Research/AI-research-SKILLs", ref: "main" },
  { source: "numman-ali/openskills", ref: "main" },
];

// User-added sources persist in ~/.claude/agent-office/skill-sources.json
// so the built-in list stays fixed but the user can add their own repos
// without editing service code.
import { APP_STATE_DIR } from "./paths";
const USER_SOURCES_FILE = join(APP_STATE_DIR, "skill-sources.json");

export type SourceRef = { source: string; ref: string };

function loadUserSources(): SourceRef[] {
  if (!existsSync(USER_SOURCES_FILE)) return [];
  try {
    const raw = JSON.parse(readFileSync(USER_SOURCES_FILE, "utf8"));
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((r): r is { source: unknown; ref: unknown } => !!r && typeof r === "object")
      .map((r) => ({ source: String(r.source ?? ""), ref: String(r.ref ?? "main") }))
      .filter((r) => r.source && /^[\w.-]+\/[\w.-]+$/.test(r.source));
  } catch { return []; }
}

function saveUserSources(sources: SourceRef[]): void {
  ensureDir(APP_STATE_DIR);
  writeFileAtomic(USER_SOURCES_FILE, JSON.stringify(sources, null, 2));
}

/** All sources: hardcoded first, then user-added. Duplicates dropped. */
function allSources(): SourceRef[] {
  const seen = new Set<string>();
  const out: SourceRef[] = [];
  for (const s of [...REGISTRY_SOURCES, ...loadUserSources()]) {
    const key = `${s.source}@${s.ref}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/**
 * Parse `https://github.com/user/repo` (with optional #branch or /tree/branch)
 * into a normalized `{ source, ref }`. Accepts owner/repo shorthand too.
 */
export function parseSourceInput(input: string): SourceRef | null {
  const s = input.trim();
  if (!s) return null;
  // Full URL
  const url = /^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/tree\/([\w./-]+))?(?:#([\w./-]+))?\/?$/i.exec(s);
  if (url) {
    const owner = url[1]!;
    const repo = url[2]!;
    const ref = url[4] || url[3] || "main";
    return { source: `${owner}/${repo}`, ref };
  }
  // owner/repo shorthand
  const short = /^([\w.-]+)\/([\w.-]+?)(?:@([\w./-]+))?$/.exec(s);
  if (short) return { source: `${short[1]}/${short[2]}`, ref: short[3] || "main" };
  return null;
}

export function addUserSource(input: string): SourceRef {
  const parsed = parseSourceInput(input);
  if (!parsed) throw new Error(`invalid source: ${input}`);
  const existing = loadUserSources();
  const key = `${parsed.source}@${parsed.ref}`;
  if (existing.some((s) => `${s.source}@${s.ref}` === key)) return parsed;
  const next = [...existing, parsed];
  saveUserSources(next);
  return parsed;
}

export function removeUserSource(source: string, ref = "main"): boolean {
  const before = loadUserSources();
  const next = before.filter((s) => !(s.source === source && s.ref === ref));
  if (next.length === before.length) return false;
  saveUserSources(next);
  return true;
}

interface CachedRegistry {
  fetchedAt: number;
  entries: RegistrySkill[];
}

const TAG_RULES: Array<{ tag: string; patterns: RegExp[]; sources?: string[] }> = [
  { tag: "documents", patterns: [/\b(pdf|docx?|pptx?|xlsx?|word|excel|powerpoint|spreadsheet|document)\b/i] },
  { tag: "design", patterns: [/\b(design|visual|theme|brand|canvas|color|typograph|layout)\b/i] },
  { tag: "art", patterns: [/\b(art|creative|generative|algorithmic|painting|aesthetic)\b/i] },
  { tag: "testing", patterns: [/\b(test|qa|playwright|cypress|webapp.testing|browser.test)\b/i] },
  { tag: "web", patterns: [/\b(web|frontend|html|css|javascript|browser)\b/i] },
  { tag: "api", patterns: [/\b(api|sdk|rest|graphql|endpoint)\b/i] },
  { tag: "documentation", patterns: [/\b(docs?|readme|tutorial|guide|markdown)\b/i] },
  { tag: "automation", patterns: [/\b(automat|workflow|orchestrat|agent|scheduled)\b/i] },
  { tag: "scraping", patterns: [/\b(scrap|crawl|extract|harvest|firecrawl)\b/i] },
  { tag: "search", patterns: [/\b(search|retrieval|rag|index)\b/i] },
  { tag: "mcp", patterns: [/\b(mcp|model.context.protocol)\b/i] },
  { tag: "security", patterns: [/\b(security|vuln|audit|owasp|csrf|xss|secret)\b/i] },
  { tag: "code-quality", patterns: [/\b(refactor|code.review|lint|format)\b/i] },
  { tag: "trading", patterns: [/\b(trade|trading|strateg|position|market|portfolio|broker)\b/i] },
  { tag: "stocks", patterns: [/\b(stock|equity|equities|sp500|s&p|nasdaq|nyse)\b/i] },
  { tag: "crypto", patterns: [/\b(crypto|btc|bitcoin|eth|ethereum|on.chain|defi|coin)\b/i] },
  { tag: "earnings", patterns: [/\b(earnings|sec|filing|10[-_]?[KkQq]|fundamentals)\b/i] },
  { tag: "calendar", patterns: [/\b(calendar|schedule|event.driven|economic.calendar)\b/i] },
  { tag: "sentiment", patterns: [/\b(sentiment|news.analysis|social.signal)\b/i] },
  { tag: "technical-analysis", patterns: [/\b(technical.analysis|indicator|rsi|macd|moving.average|chart)\b/i] },
  { tag: "risk", patterns: [/\b(risk|drawdown|stop.loss|position.sizing|kelly)\b/i] },
  { tag: "backtest", patterns: [/\b(backtest|walk.forward|monte.carlo|out.of.sample)\b/i] },
  { tag: "ml-training", patterns: [/\b(training|fine.tun|pretrain|optimizer|gradient|trainer)\b/i] },
  { tag: "ml-inference", patterns: [/\b(inference|serv|deploy.model|onnx|tensorrt)\b/i] },
  { tag: "transformers", patterns: [/\b(transformer|attention|gpt|llama|mistral|llm)\b/i] },
  { tag: "tokenization", patterns: [/\b(tokeniz|bpe|sentencepiece|vocab)\b/i] },
  { tag: "embeddings", patterns: [/\b(embedding|vector|semantic|sentence.transformer)\b/i] },
  { tag: "rag", patterns: [/\b(rag|retrieval.augmented|reranker|qdrant|chroma|faiss|pinecone)\b/i] },
  { tag: "evaluation", patterns: [/\b(eval|benchmark|metric|score|leaderboard|promptfoo)\b/i] },
  { tag: "prompt", patterns: [/\b(prompt|few.shot|prompting)\b/i] },
  { tag: "datasets", patterns: [/\b(dataset|corpus|huggingface)\b/i] },
  { tag: "rl", patterns: [/\b(reinforcement|policy|reward|ppo|trl|dpo)\b/i] },
  { tag: "python", patterns: [/\b(python|py|pip|conda|pytorch|tensorflow|jupyter)\b/i] },
  { tag: "javascript", patterns: [/\b(javascript|typescript|nodejs?|npm|bun|deno|react|next)\b/i] },
  { tag: "shell", patterns: [/\b(bash|shell|cli|terminal)\b/i] },
  { tag: "slack", patterns: [/\b(slack|gif)\b/i] },
  { tag: "presentations", patterns: [/\b(pptx|powerpoint|slide|deck|present)\b/i] },
];

const SOURCE_TAGS: Record<string, string[]> = {
  "anthropics/skills": ["anthropic", "official"],
  "tradermonty/claude-trading-skills": ["trading", "community"],
  "Orchestra-Research/AI-research-SKILLs": ["ai-research", "ml", "community"],
  "numman-ali/openskills": ["example", "community"],
};

function deriveTags(source: string, name: string, description: string, path: string): string[] {
  const haystack = [name, description, path].join(" ").toLowerCase();
  const tags = new Set<string>();
  for (const t of SOURCE_TAGS[source] ?? []) tags.add(t);
  for (const rule of TAG_RULES) {
    if (rule.sources && !rule.sources.includes(source)) continue;
    if (rule.patterns.some((p) => p.test(haystack))) tags.add(rule.tag);
  }
  return Array.from(tags).sort();
}

function ensureSkillsDir(): void {
  ensureDir(SKILLS_DIR);
}

function loadCachedRegistry(): CachedRegistry | null {
  if (!existsSync(REGISTRY_CACHE)) return null;
  try {
    return JSON.parse(readFileSync(REGISTRY_CACHE, "utf8")) as CachedRegistry;
  } catch {
    return null;
  }
}

function saveCachedRegistry(c: CachedRegistry): void {
  ensureSkillsDir();
  writeFileAtomic(REGISTRY_CACHE, JSON.stringify(c, null, 2));
}

export function isInstalled(name: string): boolean {
  return existsSync(join(SKILLS_DIR, name, "SKILL.md"));
}

function provenancePath(name: string): string {
  return join(SKILLS_DIR, name, ".source.json");
}

function readProvenance(name: string): SkillProvenance | null {
  const p = provenancePath(name);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as SkillProvenance;
  } catch {
    return null;
  }
}

interface TreeEntry {
  path: string;
  type: string;
  sha: string;
}

async function fetchTree(source: string, ref: string): Promise<TreeEntry[]> {
  const url = `https://api.github.com/repos/${source}/git/trees/${ref}?recursive=1`;
  const res = await fetch(url, { headers: { "User-Agent": "agent-office" } });
  if (!res.ok) throw new Error(`tree ${source}@${ref}: ${res.status}`);
  const data = (await res.json()) as { tree: TreeEntry[]; truncated?: boolean };
  if (data.truncated) log.warn("tree.truncated", { source, ref });
  return data.tree;
}

async function fetchSkillMd(source: string, ref: string, path: string): Promise<string> {
  const rawUrl = `https://raw.githubusercontent.com/${source}/${ref}/${path}`;
  const res = await fetch(rawUrl);
  if (!res.ok) throw new Error(`raw ${path}: ${res.status}`);
  return res.text();
}

function parseFrontmatterDescription(content: string): string {
  const fm = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return "";
  try {
    const meta = parseYaml(fm[1]!) as { description?: string };
    return meta?.description ?? "";
  } catch {
    return "";
  }
}

function dedupeName(name: string, source: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const suffix = source.split("/").pop() ?? source;
  const withSuffix = `${name}@${suffix}`;
  if (!used.has(withSuffix)) {
    used.add(withSuffix);
    return withSuffix;
  }
  let n = 2;
  while (used.has(`${withSuffix}-${n}`)) n++;
  used.add(`${withSuffix}-${n}`);
  return `${withSuffix}-${n}`;
}

async function pLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    results.push(...await Promise.all(items.slice(i, i + limit).map(fn)));
  }
  return results;
}

export async function fetchRegistry(force = false): Promise<RegistrySkill[]> {
  const cached = loadCachedRegistry();
  if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.entries.map((e) => ({
      ...e,
      tags: e.tags?.length ? e.tags : deriveTags(e.source, e.name, e.description, e.path),
      installed: isInstalled(e.name),
    }));
  }

  const out: RegistrySkill[] = [];
  const usedNames = new Set<string>();

  for (const src of allSources()) {
    try {
      const tree = await fetchTree(src.source, src.ref);
      const skillBlobs = tree.filter((t) => t.type === "blob" && t.path.endsWith("/SKILL.md"));

      const results = await pLimit(skillBlobs, 5, async (blob) => {
        const dirPath = blob.path.slice(0, -"/SKILL.md".length);
        const rawName = dirPath.split("/").pop() ?? dirPath;
        let description = "";
        try {
          const content = await fetchSkillMd(src.source, src.ref, blob.path);
          description = parseFrontmatterDescription(content);
        } catch (e) {
          log.warn("registry.fetch_skill_failed", { path: blob.path, err: String(e) });
        }
        return {
          source: src.source,
          ref: src.ref,
          rawName,
          description,
          path: dirPath,
          sha: blob.sha,
        };
      });

      for (const r of results) {
        const name = dedupeName(r.rawName, src.source, usedNames);
        out.push({
          source: r.source,
          ref: r.ref,
          name,
          description: r.description,
          path: r.path,
          sha: r.sha,
          tags: deriveTags(r.source, r.rawName, r.description, r.path),
          installed: isInstalled(name),
        });
      }
    } catch (e) {
      log.warn("registry.source_failed", { source: src.source, err: String(e) });
    }
  }

  out.sort((a, b) => a.name.localeCompare(b.name));
  saveCachedRegistry({ fetchedAt: Date.now(), entries: out });
  return out;
}

export async function installSkill(
  source: string,
  ref: string,
  path: string,
  name: string,
): Promise<{ filesWritten: number }> {
  ensureSkillsDir();

  const tree = await fetchTree(source, ref);
  const prefix = path + "/";
  const files = tree.filter((t) => t.type === "blob" && t.path.startsWith(prefix));
  if (files.length === 0) throw new Error(`no files under ${path}`);

  const skillMdEntry = files.find((f) => f.path === `${path}/SKILL.md`);
  const skillSha = skillMdEntry?.sha ?? "";

  const dest = join(SKILLS_DIR, name);
  const staging = `${dest}.tmp-${randomUUID()}`;
  mkdirSync(staging, { recursive: true });

  let written = 0;
  try {
    for (const file of files) {
      const rel = file.path.slice(prefix.length);
      const localPath = join(staging, rel);
      mkdirSync(dirname(localPath), { recursive: true });
      const rawUrl = `https://raw.githubusercontent.com/${source}/${ref}/${file.path}`;
      const fileRes = await fetch(rawUrl);
      if (!fileRes.ok) {
        log.warn("install.file_failed", { path: file.path, status: fileRes.status });
        continue;
      }
      const buf = await fileRes.arrayBuffer();
      writeFileSync(localPath, Buffer.from(buf));
      written++;
    }

    writeFileSync(
      join(staging, ".source.json"),
      JSON.stringify(
        { source, ref, path, sha: skillSha, installedAt: new Date().toISOString() },
        null,
        2,
      ),
    );

    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
    renameSync(staging, dest);
  } catch (e) {
    rmSync(staging, { recursive: true, force: true });
    throw e;
  }

  log.info("skill.installed", { name, source, files: written, sha: skillSha.slice(0, 8) });
  return { filesWritten: written };
}

export function uninstallSkill(name: string): boolean {
  const dest = join(SKILLS_DIR, name);
  if (!existsSync(dest)) return false;
  rmSync(dest, { recursive: true, force: true });
  log.info("skill.removed", { name });
  return true;
}

export function listInstalled(): InstalledSkill[] {
  if (!existsSync(SKILLS_DIR)) return [];
  const out: InstalledSkill[] = [];
  for (const dir of readdirSync(SKILLS_DIR)) {
    if (dir.startsWith("_")) continue;
    const skillMdPath = join(SKILLS_DIR, dir, "SKILL.md");
    if (!existsSync(skillMdPath)) continue;
    const content = readFileSync(skillMdPath, "utf8");
    const fm = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    let description = "";
    let body = content;
    if (fm) {
      try {
        const meta = parseYaml(fm[1]!) as { description?: string };
        description = meta?.description ?? "";
      } catch {
        /* leave description empty */
      }
      body = fm[2]!.trim();
    }
    out.push({
      name: dir,
      description,
      body,
      provenance: readProvenance(dir) ?? undefined,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function readInstalledSkill(name: string): InstalledSkill | null {
  const skillMdPath = join(SKILLS_DIR, name, "SKILL.md");
  if (!existsSync(skillMdPath)) return null;
  const content = readFileSync(skillMdPath, "utf8");
  const fm = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  let description = "";
  let body = content;
  if (fm) {
    try {
      const meta = parseYaml(fm[1]!) as { description?: string };
      description = meta?.description ?? "";
    } catch {
      /* leave description empty */
    }
    body = fm[2]!.trim();
  }
  return {
    name,
    description,
    body,
    provenance: readProvenance(name) ?? undefined,
  };
}

export async function checkForUpdates(): Promise<SkillUpdate[]> {
  const installed = listInstalled();
  if (installed.length === 0) return [];

  const bySource = new Map<string, InstalledSkill[]>();
  for (const s of installed) {
    if (!s.provenance) continue;
    const key = `${s.provenance.source}@${s.provenance.ref}`;
    let bucket = bySource.get(key);
    if (!bucket) {
      bucket = [];
      bySource.set(key, bucket);
    }
    bucket.push(s);
  }

  const updates: SkillUpdate[] = [];
  for (const [key, skills] of bySource) {
    const [source, ref] = key.split("@") as [string, string];
    try {
      const tree = await fetchTree(source, ref);
      const byPath = new Map<string, TreeEntry>();
      for (const t of tree) if (t.type === "blob") byPath.set(t.path, t);
      for (const s of skills) {
        if (!s.provenance) continue;
        const skillMdPath = `${s.provenance.path}/SKILL.md`;
        const remote = byPath.get(skillMdPath);
        if (!remote) continue;
        if (remote.sha !== s.provenance.sha) {
          updates.push({
            name: s.name,
            currentSha: s.provenance.sha,
            latestSha: remote.sha,
            source: s.provenance.source,
            path: s.provenance.path,
          });
        }
      }
    } catch (e) {
      log.warn("update_check.source_failed", { source, err: String(e) });
    }
  }
  return updates;
}

export async function updateSkill(name: string): Promise<{ filesWritten: number; sha: string }> {
  const prov = readProvenance(name);
  if (!prov) throw new Error(`no provenance for ${name} - can't update`);
  const result = await installSkill(prov.source, prov.ref, prov.path, name);
  const newProv = readProvenance(name);
  return { filesWritten: result.filesWritten, sha: newProv?.sha ?? "" };
}

export function buildSkillsPrompt(skills: string[]): string {
  const fragments: string[] = [];
  for (const name of skills) {
    const skill = readInstalledSkill(name);
    if (skill?.body) {
      fragments.push(`### Skill: ${skill.name}\n\n${skill.body}`);
    }
  }
  return fragments.join("\n\n---\n\n");
}

export function registrySources(): Array<{ source: string; ref: string; builtIn: boolean }> {
  const users = new Set(loadUserSources().map((s) => `${s.source}@${s.ref}`));
  return allSources().map((s) => ({ source: s.source, ref: s.ref, builtIn: !users.has(`${s.source}@${s.ref}`) }));
}

// ── Static skill manifest / compatibility (curated JSON in _skills/) ──────
//
// Both files are generated/maintained externally by the user's `_install.py`
// tool. We expose them to the frontend so the skill picker can show
// cost/impact info and (future) warn about conflicting selections.

const MANIFEST_PATH = join(SKILLS_DIR, "_manifest.json");
const COMPATIBILITY_PATH = join(SKILLS_DIR, "_compatibility.json");

export interface SkillManifestEntry {
  slug: string;
  source_id?: string;
  source_path?: string;
  symlink_status?: string;
  target?: string;
  category?: string;
  workflow_depth?: string;
  token_cost_est?: number;
  impact_tier?: string;
  impact_emoji?: string;
  description?: string;
}

export interface SkillManifest {
  generated_at?: string;
  generator?: string;
  cost_indicator_scale?: Record<string, string>;
  workflow_depth_legend?: Record<string, string>;
  sources?: Record<string, unknown>;
  skills: SkillManifestEntry[];
}

export interface SkillCompatibility {
  conflicts?: unknown;
  synergies?: unknown;
  ab_test_pairs?: unknown;
  [k: string]: unknown;
}

export function readManifest(): SkillManifest | null {
  if (!existsSync(MANIFEST_PATH)) return null;
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as SkillManifest;
  } catch (e) {
    log.warn("skills.manifest_parse_failed", { err: String(e) });
    return null;
  }
}

export function readCompatibility(): SkillCompatibility | null {
  if (!existsSync(COMPATIBILITY_PATH)) return null;
  try {
    return JSON.parse(readFileSync(COMPATIBILITY_PATH, "utf8")) as SkillCompatibility;
  } catch (e) {
    log.warn("skills.compatibility_parse_failed", { err: String(e) });
    return null;
  }
}
