// Persists per-conversation composer draft text via /api/drafts.

function parseKey(key: string): { agentId: string; instanceId: string } {
  const idx = key.indexOf("::");
  if (idx === -1) return { agentId: key, instanceId: "default" };
  return { agentId: key.slice(0, idx), instanceId: key.slice(idx + 2) || "default" };
}

export async function loadDraft(key: string): Promise<string> {
  const { agentId, instanceId } = parseKey(key);
  try {
    const res = await fetch(`/api/drafts?agentId=${encodeURIComponent(agentId)}&instanceId=${encodeURIComponent(instanceId)}`);
    if (!res.ok) return "";
    const data = await res.json() as { text: string };
    return typeof data.text === "string" ? data.text : "";
  } catch {
    return "";
  }
}

export async function saveDraft(key: string, text: string): Promise<void> {
  const { agentId, instanceId } = parseKey(key);
  try {
    await fetch(
      `/api/drafts?agentId=${encodeURIComponent(agentId)}&instanceId=${encodeURIComponent(instanceId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      },
    );
  } catch { /* best-effort */ }
}

export async function clearDraft(key: string): Promise<void> {
  await saveDraft(key, "");
}
