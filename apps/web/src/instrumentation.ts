/**
 * Next.js server-lifecycle hook. The `register` function fires once
 * when the Node.js runtime boots (dev: on `pnpm dev` start; prod: on
 * `pnpm start`). We use it to run the starter-kit bootstrap exactly
 * once per server lifetime, so a fresh install lands with demo agents
 * and skills in place before the first request hits.
 *
 * The Edge runtime invokes this too, but we gate to nodejs because the
 * bootstrap touches the filesystem.
 */
export async function register() {
  if (process.env["NEXT_RUNTIME"] !== "nodejs") return;
  const { bootstrapStarterDataIfNeeded } = await import(
    "@agent-office/shared/services/starter-bootstrap"
  );
  try {
    const result = bootstrapStarterDataIfNeeded();
    if (!result.skipped && (result.agentsCopied > 0 || result.skillsCopied > 0)) {
      // Single-line log so it shows up clearly in the dev terminal on
      // first run and stays out of the way otherwise.
      // eslint-disable-next-line no-console
      console.log(
        `[starter-bootstrap] seeded ${result.agentsCopied} agent(s), ${result.skillsCopied} skill(s)`,
      );
    }
  } catch (err) {
    // Never crash server startup over a missing/optional bundle.
    // eslint-disable-next-line no-console
    console.warn("[starter-bootstrap] skipped:", err);
  }
}
