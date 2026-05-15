import type { ApiAgent } from "@agent-office/shared/types";

const NAME_MAP: Array<[RegExp, string]> = [
  [/architect|planner|design.*system/i,   "🧙"],
  [/frontend|ui|ux|css|style|craft/i,     "🎨"],
  [/backend|api|server|database|db/i,     "⚙️"],
  [/developer|engineer|fullstack|builder/i,"🛠"],
  [/qa|test|tester|quality/i,             "🦊"],
  [/reviewer|review|audit/i,              "👁"],
  [/explore|search|find|discover/i,       "🔍"],
  [/security|guard|shield|pen.*test/i,    "🛡️"],
  [/doc|scribe|writer|content/i,          "📝"],
  [/data|ml|llm|ai|model|neural/i,        "🤖"],
  [/marketing|growth|seo|copy/i,          "📣"],
  [/infra|devops|deploy|ops|cloud/i,      "🚀"],
  [/perf|bench|optim/i,                   "⚡"],
  [/research|analyst|analyst/i,           "🔬"],
  [/general|claude|summon/i,              "✨"],
];

const CATEGORY_MAP: Record<string, string> = {
  Engineering: "🛠",
  QA:          "🦊",
  Design:      "🎨",
  "AI & Data": "🤖",
  Security:    "🛡️",
  Docs:        "📝",
  Marketing:   "📣",
  Research:    "🔬",
  Other:       "🧩",
};

export function emojiForAgent(agent: ApiAgent): string {
  const id = agent.name.toLowerCase();
  for (const entry of NAME_MAP) {
    if (entry[0].test(id)) return entry[1];
  }
  if (agent.room && CATEGORY_MAP[agent.room]) return CATEGORY_MAP[agent.room] as string;
  const seeds = "🧩🌀🔮🎯🗂️🧭🪄🧲";
  let h = 0;
  for (let i = 0; i < agent.name.length; i++) h = (h * 31 + agent.name.charCodeAt(i)) >>> 0;
  return [...seeds][h % [...seeds].length] ?? "🧩";
}
