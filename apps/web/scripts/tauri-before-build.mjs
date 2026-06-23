// Cross-platform `beforeBuildCommand` for Tauri (tauri.conf.json).
//
// Replaces the previous bash-only one-liner
//   "unset __NEXT_PRIVATE_STANDALONE_CONFIG && pnpm exec next build && node scripts/prepare-bundle.mjs"
// which failed on Windows (`unset` is a bash builtin, errors in cmd.exe). This
// runs identically on Windows/macOS/Linux.
//
// __NEXT_PRIVATE_STANDALONE_CONFIG is set by some Tauri/Next flows; clearing it
// keeps the web build using next.config.mjs directly.
import { spawnSync } from "node:child_process";

delete process.env.__NEXT_PRIVATE_STANDALONE_CONFIG;

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    // pnpm/next are `.cmd` shims on Windows; spawn needs a shell to launch them.
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    console.error(`\n[tauri-before-build] "${command} ${args.join(" ")}" failed (exit ${result.status}).`);
    process.exit(result.status ?? 1);
  }
}

run("pnpm", ["exec", "next", "build"]);
run("node", ["scripts/prepare-bundle.mjs"]);
