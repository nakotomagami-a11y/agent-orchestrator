// `claude --version` cache. Refreshed on demand.

import { spawn } from "node:child_process";
import type { HealthInfo } from "../types/index";
import { buildAugmentedPath, resolveClaudeCommand } from "./paths";

interface HealthState {
  cached: HealthInfo | null;
  inflight: Promise<HealthInfo> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __agentOfficeHealthState: HealthState | undefined;
}

const state: HealthState =
  globalThis.__agentOfficeHealthState ??
  (globalThis.__agentOfficeHealthState = { cached: null, inflight: null });

function probe(): Promise<HealthInfo> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    try {
      const cmd = resolveClaudeCommand();
      const useShell = process.platform === "win32" && cmd.toLowerCase().endsWith(".cmd");
      const proc = spawn(cmd, ["--version"], {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, PATH: buildAugmentedPath() },
        shell: useShell,
      });
      proc.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      proc.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      proc.on("error", (err) => {
        resolve({ available: false, version: null, error: String(err) });
      });
      // Use "close" not "exit" — "exit" fires before stdout finishes
      // draining, so if `claude --version` output arrives across multiple
      // chunks the promise can resolve with an empty stdout. "close" only
      // fires after all stdio streams are flushed. Matches the pattern
      // already used in runs.ts.
      proc.on("close", (code) => {
        if (code === 0) {
          resolve({ available: true, version: stdout.trim() });
        } else {
          resolve({ available: false, version: null, error: stderr.trim() || `exit ${code}` });
        }
      });
    } catch (e) {
      resolve({ available: false, version: null, error: String(e) });
    }
  });
}

export async function getHealth(force = false): Promise<HealthInfo> {
  if (!force && state.cached) return state.cached;
  if (!state.inflight) {
    state.inflight = probe().then((info) => {
      state.cached = info;
      state.inflight = null;
      return info;
    });
  }
  return state.inflight;
}
