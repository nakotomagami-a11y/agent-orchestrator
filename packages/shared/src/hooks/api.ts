/**
 * Single fetch wrapper used by every React Query hook. Handles JSON parsing,
 * error normalization, and automatic 4xx/5xx → throw conversion.
 *
 * Hooks should call `apiFetch<TResponse>(url, init?)` — never bare `fetch()`.
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
    let payload: Record<string, unknown> | null = null;
    try {
      const parsed: unknown = await res.json();
      if (parsed && typeof parsed === "object") {
        payload = parsed as Record<string, unknown>;
      }
    } catch {
      /* non-json error */
    }
    const errorValue = payload?.error;
    const message =
      (typeof errorValue === "string" ? errorValue : null) ?? res.statusText ?? `HTTP ${res.status}`;
    const fieldsValue = payload?.fields;
    const fields =
      fieldsValue && typeof fieldsValue === "object"
        ? (fieldsValue as Record<string, string[]>)
        : undefined;
    throw new ApiError(res.status, message, fields);
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
