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
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

delete process.env.__NEXT_PRIVATE_STANDALONE_CONFIG;

// Clean .next before building. On Windows a prior `output: standalone` build
// leaves directory symlinks under .next/standalone that the next `next build`
// cannot scandir (EPERM), so the build is not repeatable without a clean slate.
// rmSync unlinks symlinks without following them, so it clears them safely.
const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
rmSync(join(webRoot, ".next"), { recursive: true, force: true });

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
