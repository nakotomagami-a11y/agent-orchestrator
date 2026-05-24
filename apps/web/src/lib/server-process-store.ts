interface ProcessRecord {
  lines: string[];
  exitCode: number | null;
  signal: string | null;
  createdAt: number;
}

const MAX_LINES = 500;
const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const store = new Map<number, ProcessRecord>();

export function registerProcess(pid: number) {
  store.set(pid, { lines: [], exitCode: null, signal: null, createdAt: Date.now() });
}

export function appendLine(pid: number, line: string) {
  const rec = store.get(pid);
  if (!rec) return;
  rec.lines.push(line);
  if (rec.lines.length > MAX_LINES) rec.lines.shift();
}

export function setExited(pid: number, code: number | null, signal: string | null) {
  const rec = store.get(pid);
  if (rec) { rec.exitCode = code; rec.signal = signal; }
}

export function getProcess(pid: number): ProcessRecord | undefined {
  return store.get(pid);
}

export function deleteProcess(pid: number) {
  store.delete(pid);
}

setInterval(() => {
  const cutoff = Date.now() - TTL_MS;
  for (const [pid, rec] of store) {
    // Evict entries that have exceeded the TTL regardless of process state.
    if (rec.createdAt < cutoff) {
      store.delete(pid);
      continue;
    }
    // Evict entries whose process no longer exists.
    try {
      process.kill(pid, 0);
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === "ESRCH") store.delete(pid);
    }
  }
}, 60_000).unref();
