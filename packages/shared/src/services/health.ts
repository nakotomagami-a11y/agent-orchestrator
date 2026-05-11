// `claude --version` cache. Refreshed on demand.

import { spawn } from "node:child_process";
import type { HealthInfo } from "../types/index";

let cached: HealthInfo | null = null;
let inflight: Promise<HealthInfo> | null = null;

function probe(): Promise<HealthInfo> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    try {
      const proc = spawn("claude", ["--version"], { stdio: ["ignore", "pipe", "pipe"] });
      proc.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      proc.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      proc.on("error", (err) => {
        resolve({ available: false, version: null, error: String(err) });
      });
      proc.on("exit", (code) => {
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
  if (!force && cached) return cached;
  if (!inflight) {
    inflight = probe().then((info) => {
      cached = info;
      inflight = null;
      return info;
    });
  }
  return inflight;
}
