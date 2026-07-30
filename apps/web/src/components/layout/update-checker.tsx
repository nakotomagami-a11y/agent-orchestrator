"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ModalShell } from "@/components/ui/modal-shell";
import { Icon } from "@/components/ui/icon";
import { ACCENT_BTN } from "@/lib/button-styles";
import {
  CHECK_UPDATE_EVENT,
  checkForUpdate,
  relaunchApp,
  type PendingUpdate,
} from "@/lib/updater";

type Phase = "idle" | "available" | "downloading" | "installed" | "uptodate";

/**
 * Watches for signed app updates via the Tauri updater. On launch it checks
 * silently and only surfaces a modal when a newer build exists. A manual
 * "Check for updates" control anywhere can dispatch `CHECK_UPDATE_EVENT`
 * to trigger a foreground check (which also reports "up to date").
 *
 * No-ops in the browser — checkForUpdate() returns null there.
 */
export function UpdateChecker() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [update, setUpdate] = useState<PendingUpdate | null>(null);
  const [progress, setProgress] = useState<number | null>(0);
  const [error, setError] = useState<string | null>(null);
  const checking = useRef(false);

  const runCheck = useCallback(async (manual: boolean) => {
    if (checking.current) return;
    checking.current = true;
    try {
      const found = await checkForUpdate();
      if (found) {
        setUpdate(found);
        setPhase("available");
      } else if (manual) {
        setPhase("uptodate");
      }
    } finally {
      checking.current = false;
    }
  }, []);

  // Silent check on launch.
  useEffect(() => {
    void runCheck(false);
  }, [runCheck]);

  // Manual "Check for updates" trigger.
  useEffect(() => {
    const onCheck = () => void runCheck(true);
    window.addEventListener(CHECK_UPDATE_EVENT, onCheck);
    return () => window.removeEventListener(CHECK_UPDATE_EVENT, onCheck);
  }, [runCheck]);

  const install = useCallback(async () => {
    if (!update) return;
    setError(null);
    setPhase("downloading");
    setProgress(0);
    try {
      await update.install((f) => setProgress(f));
      setPhase("installed");
      // Give the "installed" state a beat to render, then relaunch.
      setTimeout(() => void relaunchApp(), 600);
    } catch {
      setError("Update failed to download. Try again later.");
      setPhase("available");
    }
  }, [update]);

  const close = useCallback(() => {
    if (phase === "downloading") return; // don't let them bail mid-install
    setPhase("idle");
  }, [phase]);

  const open = phase !== "idle";
  const info = update?.info;
  const pct = progress == null ? null : Math.round(progress * 100);

  return (
    <ModalShell
      open={open}
      onClose={close}
      size="sm"
      title={phase === "uptodate" ? "You're up to date" : "Update available"}
      footer={
        phase === "available" ? (
          <>
            <button
              type="button"
              onClick={close}
              className="h-[30px] px-[12px] rounded-md border border-line bg-transparent text-txt-2 text-[12.5px] cursor-pointer hover:bg-bg-2"
            >
              Later
            </button>
            <button
              type="button"
              onClick={() => void install()}
              className={`${ACCENT_BTN} inline-flex items-center gap-[6px] px-[12px] py-[6px] rounded-[6px] text-[12.5px] font-semibold cursor-pointer`}
            >
              <Icon name="download" size={13} />
              Download &amp; install
            </button>
          </>
        ) : phase === "installed" ? (
          <button
            type="button"
            onClick={() => void relaunchApp()}
            className={`${ACCENT_BTN} inline-flex items-center gap-[6px] px-[12px] py-[6px] rounded-[6px] text-[12.5px] font-semibold cursor-pointer`}
          >
            <Icon name="refresh" size={13} />
            Restart now
          </button>
        ) : phase === "uptodate" ? (
          <button
            type="button"
            onClick={close}
            className="h-[30px] px-[12px] rounded-md border border-line bg-transparent text-txt-2 text-[12.5px] cursor-pointer hover:bg-bg-2"
          >
            Close
          </button>
        ) : null
      }
    >
      {phase === "uptodate" ? (
        <p className="text-[13px] text-txt-2">You're running the latest version.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-txt-2">
            Version <span className="font-semibold text-txt">{info?.version}</span> is available
            {info?.currentVersion ? (
              <> — you have <span className="font-mono text-txt-3">{info.currentVersion}</span>.</>
            ) : (
              "."
            )}
          </p>

          {info?.notes ? (
            <div className="max-h-[180px] overflow-auto rounded-md border border-line bg-bg-2 p-2 text-[12px] text-txt-2 whitespace-pre-wrap">
              {info.notes}
            </div>
          ) : null}

          {phase === "downloading" ? (
            <div className="flex flex-col gap-1.5">
              <div className="h-[6px] w-full overflow-hidden rounded-full bg-bg-3">
                <div
                  className="h-full rounded-full bg-acc transition-[width] duration-150"
                  style={{ width: pct == null ? "100%" : `${pct}%` }}
                />
              </div>
              <span className="text-[11px] text-txt-3">
                {pct == null ? "Downloading…" : `Downloading… ${pct}%`}
              </span>
            </div>
          ) : null}

          {phase === "installed" ? (
            <p className="text-[12.5px] text-txt-2">Installed. Restarting…</p>
          ) : null}

          {error ? <p className="text-[12px] text-[var(--error)]">{error}</p> : null}
        </div>
      )}
    </ModalShell>
  );
}
