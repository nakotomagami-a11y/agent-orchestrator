// Skill registry + install + update.
// Skills live at ~/.claude/agents/_skills/<name>/SKILL.md (app-managed, not Claude
// Code's global ~/.claude/skills/). Provenance is tracked in <name>/.source.json
// so we can detect remote updates.

import {
  existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { parse as parseYaml } from "yaml";
import type {
  RegistrySkill, InstalledSkill, SkillProvenance, SkillUpdate,
} from "../shared/types";
import { log } from "./log";

export const SKILLS_DIR = join(homedir(), ".claude", "agents", "_skills");
const REGISTRY_CACHE = join(SKILLS_DIR, "_registry.json");
const CACHE_TTL_MS = 60 * 60 * 1000;

// Registry sources. Add new ones here — the scanner walks the full tree of each
// repo looking for **/SKILL.md, so no subdir hint is required.
const REGISTRY_SOURCES = [
  { source: "anthropics/skills",                 ref: "main" },
  { source: "tradermonty/claude-trading-skills", ref: "main" },
  { source: "Orchestra-Research/AI-research-SKILLs", ref: "main" },
  { source: "numman-ali/openskills",             ref: "main" },
];

interface CachedRegistry { fetchedAt: number; entries: RegistrySkill[]; }

// Tag derivation — keyword/path-based, no NLP. Each entry: tag → regex(es) that
// must match (case-insensitive) somewhere in name + description + path.
const TAG_RULES: Array<{ tag: string; patterns: RegExp[]; sources?: string[] }> = [
  // Domain — primary
  { tag: "documents",  patterns: [/\b(pdf|docx?|pptx?|xlsx?|word|excel|powerpoint|spreadsheet|document)\b/i] },
  { tag: "design",     patterns: [/\b(design|visual|theme|brand|canvas|color|typograph|layout)\b/i] },
  { tag: "art",        patterns: [/\b(art|creative|generative|algorithmic|painting|aesthetic)\b/i] },
  { tag: "testing",    patterns: [/\b(test|qa|playwright|cypress|webapp.testing|browser.test)\b/i] },
  { tag: "web",        patterns: [/\b(web|frontend|html|css|javascript|browser)\b/i] },
  { tag: "api",        patterns: [/\b(api|sdk|rest|graphql|endpoint)\b/i] },
  { tag: "documentation", patterns: [/\b(docs?|readme|tutorial|guide|markdown)\b/i] },
  { tag: "automation", patterns: [/\b(automat|workflow|orchestrat|agent|scheduled)\b/i] },
  { tag: "scraping",   patterns: [/\b(scrap|crawl|extract|harvest|firecrawl)\b/i] },
  { tag: "search",     patterns: [/\b(search|retrieval|rag|index)\b/i] },
  { tag: "mcp",        patterns: [/\b(mcp|model.context.protocol)\b/i] },
  { tag: "security",   patterns: [/\b(security|vuln|audit|owasp|csrf|xss|secret)\b/i] },
  { tag: "code-quality", patterns: [/\b(refactor|code.review|lint|format)\b/i] },

  // Trading & finance
  { tag: "trading",    patterns: [/\b(trade|trading|strateg|position|market|portfolio|broker)\b/i] },
  { tag: "stocks",     patterns: [/\b(stock|equity|equities|sp500|s&p|nasdaq|nyse)\b/i] },
  { tag: "crypto",     patterns: [/\b(crypto|btc|bitcoin|eth|ethereum|on.chain|defi|coin)\b/i] },
  { tag: "earnings",   patterns: [/\b(earnings|sec|filing|10[-_]?[KkQq]|fundamentals)\b/i] },
  { tag: "calendar",   patterns: [/\b(calendar|schedule|event.driven|economic.calendar)\b/i] },
  { tag: "sentiment",  patterns: [/\b(sentiment|news.analysis|social.signal)\b/i] },
  { tag: "technical-analysis", patterns: [/\b(technical.analysis|indicator|rsi|macd|moving.average|chart)\b/i] },
  { tag: "risk",       patterns: [/\b(risk|drawdown|stop.loss|position.sizing|kelly)\b/i] },
  { tag: "backtest",   patterns: [/\b(backtest|walk.forward|monte.carlo|out.of.sample)\b/i] },

  // ML / AI
  { tag: "ml-training",  patterns: [/\b(training|fine.tun|pretrain|optimizer|gradient|trainer)\b/i] },
  { tag: "ml-inference", patterns: [/\b(inference|serv|deploy.model|onnx|tensorrt)\b/i] },
  { tag: "transformers", patterns: [/\b(transformer|attention|gpt|llama|mistral|llm)\b/i] },
  { tag: "tokenization", patterns: [/\b(tokeniz|bpe|sentencepiece|vocab)\b/i] },
  { tag: "embeddings",   patterns: [/\b(embedding|vector|semantic|sentence.transformer)\b/i] },
  { tag: "rag",          patterns: [/\b(rag|retrieval.augmented|reranker|qdrant|chroma|faiss|pinecone)\b/i] },
  { tag: "evaluation",   patterns: [/\b(eval|benchmark|metric|score|leaderboard|promptfoo)\b/i] },
  { tag: "prompt",       patterns: [/\b(prompt|few.shot|prompting)\b/i] },
  { tag: "datasets",     patterns: [/\b(dataset|corpus|huggingface)\b/i] },
  { tag: "rl",           patterns: [/\b(reinforcement|policy|reward|ppo|trl|dpo)\b/i] },

  // Languages / runtimes
  { tag: "python",       patterns: [/\b(python|py|pip|conda|pytorch|tensorflow|jupyter)\b/i] },
  { tag: "javascript",   patterns: [/\b(javascript|typescript|nodejs?|npm|bun|deno|react|next)\b/i] },
  { tag: "shell",        patterns: [/\b(bash|shell|cli|terminal)\b/i] },

  // Communication
  { tag: "slack",        patterns: [/\b(slack|gif)\b/i] },
  { tag: "presentations",patterns: [/\b(pptx|powerpoint|slide|deck|present)\b/i] },
];

const SOURCE_TAGS: Record<string, string[]> = {
  "anthropics/skills":                     ["anthropic", "official"],
  "tradermonty/claude-trading-skills":     ["trading", "community"],
  "Orchestra-Research/AI-research-SKILLs": ["ai-research", "ml", "community"],
  "numman-ali/openskills":                 ["example", "community"],
};

function deriveTags(source: string, name: string, description: string, path: string): string[] {
  const haystack = [name, description, path].join(" ").toLowerCase();
  const tags = new Set<string>();
  for (const t of SOURCE_TAGS[source] ?? []) tags.add(t);
  for (const rule of TAG_RULES) {
    if (rule.sources && !rule.sources.includes(source)) continue;
    if (rule.patterns.some(p => p.test(haystack))) tags.add(rule.tag);
  }
  return Array.from(tags).sort();
}

function ensureSkillsDir() {
  if (!existsSync(SKILLS_DIR)) mkdirSync(SKILLS_DIR, { recursive: true });
}

function loadCachedRegistry(): CachedRegistry | null {
  if (!existsSync(REGISTRY_CACHE)) return null;
  try { return JSON.parse(readFileSync(REGISTRY_CACHE, "utf8")) as CachedRegistry; }
  catch { return null; }
}

function saveCachedRegistry(c: CachedRegistry) {
  ensureSkillsDir();
  writeFileSync(REGISTRY_CACHE, JSON.stringify(c, null, 2));
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
  try { return JSON.parse(readFileSync(p, "utf8")) as SkillProvenance; }
  catch { return null; }
}

function writeProvenance(name: string, prov: SkillProvenance) {
  writeFileSync(provenancePath(name), JSON.stringify(prov, null, 2));
}

interface TreeEntry { path: string; type: string; sha: string; }

async function fetchTree(source: string, ref: string): Promise<TreeEntry[]> {
  const url = `https://api.github.com/repos/${source}/git/trees/${ref}?recursive=1`;
  const res = await fetch(url, { headers: { "User-Agent": "agent-office" } });
  if (!res.ok) throw new Error(`tree ${source}@${ref}: ${res.status}`);
  const data = await res.json() as { tree: TreeEntry[]; truncated?: boolean };
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
    const meta = parseYaml(fm[1]) as { description?: string };
    return meta?.description ?? "";
  } catch {
    return "";
  }
}

// Deduplicate name collisions across sources by appending source-fragment.
function dedupeName(name: string, source: string, used: Set<string>): string {
  if (!used.has(name)) { used.add(name); return name; }
  const suffix = source.split("/").pop() ?? source;
  const withSuffix = `${name}@${suffix}`;
  if (!used.has(withSuffix)) { used.add(withSuffix); return withSuffix; }
  let n = 2;
  while (used.has(`${withSuffix}-${n}`)) n++;
  used.add(`${withSuffix}-${n}`);
  return `${withSuffix}-${n}`;
}

export async function fetchRegistry(force = false): Promise<RegistrySkill[]> {
  const cached = loadCachedRegistry();
  if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.entries.map(e => ({
      ...e,
      // Recompute tags in case the rule set has been updated since cache was written
      tags: e.tags?.length ? e.tags : deriveTags(e.source, e.name, e.description, e.path),
      installed: isInstalled(e.name),
    }));
  }

  const out: RegistrySkill[] = [];
  const usedNames = new Set<string>();

  for (const src of REGISTRY_SOURCES) {
    try {
      const tree = await fetchTree(src.source, src.ref);
      const skillBlobs = tree.filter(t => t.type === "blob" && t.path.endsWith("/SKILL.md"));

      const results = await Promise.all(skillBlobs.map(async (blob) => {
        const dirPath = blob.path.slice(0, -"/SKILL.md".length);
        const rawName = dirPath.split("/").pop() ?? dirPath;
        let description = "";
        try {
          const content = await fetchSkillMd(src.source, src.ref, blob.path);
          description = parseFrontmatterDescription(content);
        } catch {}
        return {
          source: src.source,
          ref: src.ref,
          rawName,
          description,
          path: dirPath,
          sha: blob.sha,
        };
      }));

      for (const r of results) {
        const name = dedupeName(r.rawName, src.source, usedNames);
        out.push({
          source: r.source, ref: r.ref, name,
          description: r.description, path: r.path, sha: r.sha,
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
  source: string, ref: string, path: string, name: string,
): Promise<{ filesWritten: number }> {
  ensureSkillsDir();

  const tree = await fetchTree(source, ref);
  const prefix = path + "/";
  const files = tree.filter(t => t.type === "blob" && t.path.startsWith(prefix));
  if (files.length === 0) throw new Error(`no files under ${path}`);

  // Find the SKILL.md SHA for provenance
  const skillMdEntry = files.find(f => f.path === `${path}/SKILL.md`);
  const skillSha = skillMdEntry?.sha ?? "";

  const dest = join(SKILLS_DIR, name);
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });

  let written = 0;
  for (const file of files) {
    const rel = file.path.slice(prefix.length);
    const localPath = join(dest, rel);
    mkdirSync(dirname(localPath), { recursive: true });
    const rawUrl = `https://raw.githubusercontent.com/${source}/${ref}/${file.path}`;
    const fileRes = await fetch(rawUrl);
    if (!fileRes.ok) { log.warn("install.file_failed", { path: file.path, status: fileRes.status }); continue; }
    const buf = await fileRes.arrayBuffer();
    writeFileSync(localPath, Buffer.from(buf));
    written++;
  }

  writeProvenance(name, {
    source, ref, path, sha: skillSha,
    installedAt: new Date().toISOString(),
  });

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
    let name = dir, description = "", body = content;
    if (fm) {
      try {
        const meta = parseYaml(fm[1]) as { name?: string; description?: string };
        name = meta?.name ?? dir;
        description = meta?.description ?? "";
      } catch {}
      body = fm[2].trim();
    }
    out.push({
      name: dir, // directory name (canonical id); meta.name might differ for display
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
  let description = "", body = content;
  if (fm) {
    try {
      const meta = parseYaml(fm[1]) as { description?: string };
      description = meta?.description ?? "";
    } catch {}
    body = fm[2].trim();
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

  // Group by source so we minimise tree fetches
  const bySource = new Map<string, InstalledSkill[]>();
  for (const s of installed) {
    if (!s.provenance) continue;
    const key = `${s.provenance.source}@${s.provenance.ref}`;
    (bySource.get(key) ?? bySource.set(key, []).get(key)!).push(s);
  }

  const updates: SkillUpdate[] = [];
  for (const [key, skills] of bySource) {
    const [source, ref] = key.split("@");
    try {
      const tree = await fetchTree(source, ref);
      const byPath = new Map<string, TreeEntry>();
      for (const t of tree) if (t.type === "blob") byPath.set(t.path, t);
      for (const s of skills) {
        if (!s.provenance) continue;
        const skillMdPath = `${s.provenance.path}/SKILL.md`;
        const remote = byPath.get(skillMdPath);
        if (!remote) continue; // skill removed upstream
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
  if (!prov) throw new Error(`no provenance for ${name} — can't update`);
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

export function registrySources(): Array<{ source: string; ref: string }> {
  return REGISTRY_SOURCES.map(s => ({ source: s.source, ref: s.ref }));
}
