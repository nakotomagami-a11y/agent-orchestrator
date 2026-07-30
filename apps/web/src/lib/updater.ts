// In-app updater helpers (Tauri only).
//
// Mirrors tauri-window.ts: every call no-ops in a browser tab so the same
// React code ships to both targets. Uses dynamic imports so the plugin
// bundles are never pulled into a browser build where they'd 404.

import { isTauri } from "./tauri-window";

export type UpdateInfo = {
  version: string;
  currentVersion: string;
  notes?: string;
  date?: string;
};

export type DownloadProgress = (fraction: number | null) => void;

export type PendingUpdate = {
  info: UpdateInfo;
  /** Downloads + installs the update, reporting 0..1 progress (null = unknown size). */
  install: (onProgress?: DownloadProgress) => Promise<void>;
};

/**
 * Asks the update endpoint whether a newer signed build exists.
 * Returns null in the browser, on error, or when already up to date.
 */
export async function checkForUpdate(): Promise<PendingUpdate | null> {
  if (!isTauri()) return null;
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) return null;

    return {
      info: {
        version: update.version,
        currentVersion: update.currentVersion,
        notes: update.body,
        date: update.date,
      },
      install: async (onProgress) => {
        let total = 0;
        let downloaded = 0;
        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case "Started":
              total = event.data.contentLength ?? 0;
              onProgress?.(0);
              break;
            case "Progress":
              downloaded += event.data.chunkLength;
              onProgress?.(total ? downloaded / total : null);
              break;
            case "Finished":
              onProgress?.(1);
              break;
          }
        });
      },
    };
  } catch {
    return null;
  }
}

/** Restarts the app so the freshly-installed update takes effect. */
export async function relaunchApp(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } catch {
    // ignore — user can restart manually
  }
}

/** Custom DOM event a manual "Check for updates" control can dispatch. */
export const CHECK_UPDATE_EVENT = "office:check-update";

export function requestUpdateCheck(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CHECK_UPDATE_EVENT));
}
