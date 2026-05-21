interface ProcessRecord {
  lines: string[];
  exitCode: number | null;
  signal: string | null;
}

const MAX_LINES = 500;
const store = new Map<number, ProcessRecord>();

export function registerProcess(pid: number) {
  store.set(pid, { lines: [], exitCode: null, signal: null });
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
