# Multi-Instance Agent Decision Record

**Date:** 2026-05-24  
**Status:** Locked — implementation in progress  
**Feature flag:** `features.multiInstance` (added to `AppSettings` in `packages/shared/src/types/index.ts`)

---

## Decisions

### 1. Isolation mechanism: git worktrees (not file locks)

Each agent instance beyond the first gets its own git worktree at `<projectCwd>/.worktrees/<agentId>-<instanceId>/` on a fresh branch named `agent/<agentId>-<instanceId>`. This gives complete filesystem isolation — no cross-instance file collisions — with zero coordination protocol needed.

**Rationale:** File locks require a coordination daemon and break if the process dies. Worktrees are a native git primitive: the working tree is genuinely isolated, git itself enforces no double-checkout of the same branch, and cleanup is `git worktree remove`.

**Fallback:** Non-git project directories → all instances share the project root cwd. A warning toast is shown on spawn. No worktree is created; `instance.cwd` is `undefined` (runs fall back to `project.meta.cwd`).

---

### 2. Instance caps

| Cap | Value | Behaviour |
|-----|-------|-----------|
| Soft | 5 per agent per project | API returns `409 INSTANCE_CAP_EXCEEDED` with `{ softCap: true }`. UI shows confirmation dialog. User can override. |
| Hard | 10 per agent per project | API returns `409 INSTANCE_CAP_EXCEEDED` with `{ softCap: false }`. UI shows toast error. Cannot override. |

Caps are enforced in `addInstance()` in `packages/shared/src/services/projects.ts`.

---

### 3. Instance spawn defaults

A new instance inherits from the **agent definition** (not the parent instance):
- `model` — agent's configured model
- `effort` — agent's configured effort  
- `permissionMode` — agent's configured permissionMode
- `room` — agent's configured room
- `cwd` — worktree path (2nd+ instance) or `undefined` (1st instance, falls back to `project.meta.cwd`)
- `label` — empty (user sets via inline rename after spawn)

The **first instance** of any agent is unchanged from today: no worktree, no badge, no grouping in sidebar.

---

### 4. Instance termination

Terminating an instance via DELETE `/api/projects/[id]/roster/[instanceId]`:
1. Calls `removeWorktree(instance.worktree)` if the instance has a worktree — this runs `git worktree remove --force <path>` and deletes the branch.
2. Removes the roster entry from `project.meta`.
3. **SQLite rows stay** — runs, messages, tool_calls for this instance are archived (not deleted). `deleteRunsForInstance` is NOT called on termination. The transcript is preserved.

---

### 5. Feature flag

```json
// ~/.claude/agent-office-settings.json (or equivalent settings file)
{
  "features": {
    "multiInstance": false
  }
}
```

Flag defaults to `false`. When `false`:
- `addInstance()` creates instances normally (no worktree logic runs)
- Sidebar shows no grouping or spawn affordance
- All behaviour is identical to pre-feature state

Flip to `true` for opt-in. Will be flipped globally after Phase 5 dogfood passes.

---

### 6. Boot-time reconciliation

On app start, the server scans `<projectCwd>/.worktrees/` for each known project. Any worktree directory with no matching `instanceId` in the project's roster is an orphan (caused by crashed mid-spawn). Orphans are removed via `git worktree remove --force`. This runs once at startup, not on every request.

---

## Out of scope for v1

- Cross-instance coordination / task-claiming ("Crew Mode") — design after 30 days usage data
- Instance templates / presets
- A/B comparison view across instances
- Auto-spawn on pipeline triggers
- Multi-instance for non-developer agent types (technically works, UX untested)

---

## Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| `git worktree add` fails if branch already exists | Suffix branch name with timestamp: `agent/<agentId>-<instanceId>-<ts>` |
| Submodule weirdness in worktrees | Detected by checking `.gitmodules` on spawn; warn user, don't block |
| Hook double-triggers in worktrees | Document known issue; worktrees share hooks by design |
| Orphan accumulation on crash | Boot reconciliation (non-optional) |
| Spatial view perf with 10+ chars | Profile after Phase 4; cap visual render at 5 per agent if needed |
| Single-instance regressions | Feature flag + "1st instance unchanged" invariant in `addInstance()` |
