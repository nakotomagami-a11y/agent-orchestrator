/**
 * Single fetch wrapper used by every React Query hook. Handles JSON parsing,
 * error normalization, and automatic 4xx/5xx → throw conversion.
 *
 * Hooks should call `apiFetch<TResponse>(url, init?)` - never bare `fetch()`.
 */

export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly fields?: Record<string, string[]>) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiInit extends Omit<RequestInit, "body"> {
  body?: unknown;
  asText?: boolean;
}

interface ErrorEnvelope {
  error?: string;
  fields?: Record<string, string[]>;
}

function parseErrorEnvelope(raw: unknown): ErrorEnvelope {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const out: ErrorEnvelope = {};
  if (typeof obj.error === "string") out.error = obj.error;
  if (obj.fields && typeof obj.fields === "object" && !Array.isArray(obj.fields)) {
    const fields: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(obj.fields as Record<string, unknown>)) {
      if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
        fields[key] = value as string[];
      }
    }
    if (Object.keys(fields).length > 0) out.fields = fields;
  }
  return out;
}

export async function apiFetch<T>(url: string, init: ApiInit = {}): Promise<T> {
  const { body, asText, headers, ...rest } = init;
  const requestInit: RequestInit = {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  };

  const res = await fetch(url, requestInit);

  if (!res.ok) {
    let envelope: ErrorEnvelope = {};
    try {
      envelope = parseErrorEnvelope(await res.json());
    } catch {
      /* non-json error */
    }
    const message = envelope.error ?? res.statusText ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, message, envelope.fields);
  }

  if (asText) {
    return (await res.text()) as T;
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export async function apiUpload<T>(url: string, file: File): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) {
    throw new ApiError(res.status, res.statusText);
  }
  return (await res.json()) as T;
}
