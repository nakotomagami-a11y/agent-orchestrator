# Docs audit — 2026-07-28

Compared `README.md` and the in-app docs (`apps/web/docs/*.md`) against the actual
code. Below is what was out of date (now fixed) and what is still thin/missing.

## Fixed in this pass

### `README.md`
- **Dev port** — said `pnpm dev → http://localhost:3001`; it's `3000` (`next dev` default). Fixed.
- **Package rename** — Monorepo section listed `packages/shared/`; the package is now
  `packages/domain/` (`@agent-office/domain`). Added the missing `packages/pixel-icons/`.
- **Saved prompts → Workflows** — the "saved prompts" feature was rebranded to
  **Workflows** (migration v6→v7). API is `/api/workflows/*`; the SQLite table is still
  `saved_prompts`. Updated feature bullets, API list, module list, architecture note.
- **Pages list** — `spend` page is gone; it's now `analytics`. Root `/` is the office.
- **API list** — dropped `saved-prompts`; added `workflows, projects, settings, analytics,
  accounts, github-accounts, agent-docs, cleanup`.
- **Modules list** — removed `modules/prompts/`; added `workflows, analytics, accounts,
  github-accounts, docs, flutter`.
- **Command palette** — was described as "jump to any agent, project, run"; the palette is
  now a fixed command list (Navigate / Actions / Tools), no dynamic per-entity rows.
- Added **multi-account** + **GitHub accounts** to Integrations; added `pnpm test` (vitest).

### `apps/web/docs/08-reference.md`
- **Crash recovery** — said orphan runs get `exit_code=143 (SIGTERM)`; code sets
  `exit_code=-1` (`packages/domain/src/services/db.ts`). Fixed.
- **Saved-prompts API** — replaced the whole `/api/saved-prompts/*` table with the real
  `/api/workflows/*` (GET, POST, POST /bulk, DELETE /:id, POST /:id/use — note `:id` has
  **no** GET/PATCH).
- Added missing API groups: **Claude accounts**, **GitHub accounts**, **Analytics**,
  **Agent docs**, `skills/icons`, `cleanup/:kind`.

### `apps/web/docs/07-interface.md`
- **Slash commands** — listed `/summon` and `/save` (neither exist). Real set:
  `/clear /branch /memory /prompt /history` (`modules/summon/format/composer-config.ts`).
- **Workflows** — rewrote the "Saved prompts" section; opened via composer button (Ctrl+P),
  not `/save`; not managed under Settings.
- **Command palette** — rewrote to the real static list; removed the fictional dynamic
  Agents/Projects/Saved-prompts/Messages/Recent-runs groups.
- **Settings page** — said "two-tab layout (Projects, About You)"; it's actually seven tabs
  in four groups: Projects, Bundled agents, Claude accounts, GitHub accounts, About You,
  Performance, Cleanup (`modules/settings/components/settings-nav.tsx`).
- **Spend page → Analytics page** — route is `/analytics`, and the page has trend / model
  split / agent+project rankings / tools / heatmap / per-account, not the old flat list.

### `apps/web/docs/00-features.md` & `06-usage.md`
- **Spend caps do not exist.** There is no `quota_exceeded`, no `maxCost` per-run cap, no
  instance cap field (`AgentInstance` has none). Rewrote "Spend limits & quota" → "Spend
  tracking" and corrected the CLI-comparison table + feature bullets. Spend is *tracked*
  (Analytics + `/api/projects/:id/spend`), not *enforced*.
- Saved prompts → Workflows; Spend page → Analytics; added multi-account bullet.

### `packages/domain/src/config/routes.ts`
- Removed a stale doc-comment referencing the nonexistent `packages/shared/`.

## Still thin / worth a follow-up (not changed)
- **Multi-account / GitHub accounts** get a paragraph in Settings + a feature bullet, but no
  dedicated concept/usage walkthrough. If these are load-bearing, they deserve their own
  section in `02-concepts.md` / `06-usage.md`.
- **`ui_settings.office-view`** — `07-interface.md` says the office view mode is server-backed
  at `ui_settings.office-view`, while `08-reference.md`'s store table says `use-office-store`
  persists to localStorage. One of them is wrong; not verified this pass.
- **Bundled `src-tauri/server/apps/web/docs/` copy** is a build artifact and was left
  untouched — it regenerates on `tauri:build`.
- Per-agent starter `.md` files and `starter-data/skills` were out of scope (shipped content,
  not docs about this app).
