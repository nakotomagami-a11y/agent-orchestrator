# Data fetching

Frontend HTTP stack: **TanStack Query + axios + ts-pattern**. Every browser →
backend call flows through the same three layers. Skipping a layer (e.g. a bare
`fetch` in a component) is a bug, not a shortcut.

```
component / hook
      │  calls
      ▼
TanStack Query hook        src/modules/<x>/hooks/use-<resource>.ts
      │  calls                 (useQuery / useMutation, cache + invalidation)
      ▼
API module                 src/lib/api/<resource>.ts
      │  calls                 (one function per endpoint, typed in/out)
      ▼
axios client               src/lib/api-client.ts
                               (instance + ApiError normalization)
```

## Layers

### 1. axios client — `src/lib/api-client.ts`

A single shared `apiClient` axios instance. Its response interceptor converts
every non-2xx into the shared `ApiError` (`status`, `message`, `fields`,
`data`) — the exact error the older `apiFetch` throws — so React Query and
error handling that inspects `err.status` / `err.fields` / `err.data` work the
same regardless of transport.

- Components and hooks **do not** import `apiClient` directly.
- Only **API modules** import it.
- `apiRequest<T>(config)` is a thin helper returning just the response body.

### 2. API modules — `src/lib/api/<resource>.ts`

This is the "every API call in its own file" rule. One module per resource,
one exported function per endpoint. Functions are plain async functions —
no React, no hooks — so they're trivially testable and reusable.

```ts
// src/lib/api/projects.ts
import { API_ROUTES } from "@agent-office/shared/config/routes";
import { apiClient } from "@/lib/api-client";
import type { Project } from "@agent-office/shared/types";

export async function listProjects(): Promise<Project[]> {
  return (await apiClient.get<Project[]>(API_ROUTES.projects)).data;
}

export async function createProject(input: NewProject): Promise<Project> {
  return (await apiClient.post<Project>(API_ROUTES.projects, input)).data;
}
```

- URLs come from `API_ROUTES` (`packages/shared/src/config/routes.ts`). **Never
  hardcode a URL string** — add the route there first.
- Pass query params via axios `params: { ... }`; never build query strings by
  hand with `encodeURIComponent`.
- Request/response shapes are typed. No `any`.

### 3. TanStack Query hooks — `src/modules/<x>/hooks/use-<resource>.ts`

The hook wraps the API module in `useQuery` / `useMutation`, owns the query
key, `staleTime`, and invalidation. Server state lives here, never in Zustand.

```ts
export function useProjects() {
  return useQuery({ queryKey: ["projects", "list"], queryFn: listProjects });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createProject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}
```

## ts-pattern

`ts-pattern`'s `match(...)` replaces `switch` and `if/else if` chains —
especially over discriminated unions and status strings. Prefer it for:

- mapping a union (`run.status`, `scope.kind`, message `item.kind`) to UI/values
  with `.exhaustive()` so new variants are a compile error;
- dispatching on `event.key`, SSE event types, etc. with `.otherwise(...)`.

```ts
return match(scope)
  .with({ kind: "global" }, () => API_ROUTES.memoryGlobal)
  .with({ kind: "project" }, (s) => API_ROUTES.projectMemory(s.id))
  .with({ kind: "agent" }, (s) => API_ROUTES.agentMemory(s.id))
  .exhaustive();
```

## Rules

1. **No bare `fetch` in components or hooks.** Go through an API module.
2. **One API module per resource**, one function per endpoint, under
   `src/lib/api/`.
3. **URLs only from `API_ROUTES`.** Add new endpoints there first.
4. **Server state is TanStack Query**, never Zustand.
5. **Errors are `ApiError`.** Catch/branch on `err.status` — don't re-parse
   response bodies.
6. **`match()` over `switch`/`if-else` chains** where a value drives the branch.

## Exceptions

- **SSE / streaming** (`/api/runs/:id/stream`, summon) uses `EventSource` /
  manual `fetch` + `ReadableStream`, not axios — axios doesn't stream response
  bodies in the browser. Keep those in their dedicated stream hooks.
- **One-shot imperative side effects** (e.g. the localStorage→SQLite migration
  in `use-migrate-local-storage.ts`) call API modules directly inside an
  effect. That's fine — they still go through the api-module + axios layer; they
  just aren't a natural `useMutation`.

## Migration status

`apiFetch` (`packages/shared/src/hooks/api.ts`) is the legacy native-`fetch`
wrapper. It throws the same `ApiError`, so it interops cleanly. New code uses
axios + API modules; existing `apiFetch` call sites are migrated to API modules
incrementally — do it whenever you touch a hook, don't big-bang it.
