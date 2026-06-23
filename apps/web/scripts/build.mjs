// Cross-platform replacement for "unset __NEXT_PRIVATE_STANDALONE_CONFIG; next build".
// `unset` is a bash builtin and fails on Windows (cmd.exe). The Tauri build sets
// this private Next var; clearing it keeps a plain web build using next.config.mjs.
import { spawnSync } from "node:child_process";

delete process.env.__NEXT_PRIVATE_STANDALONE_CONFIG;

const result = spawnSync("next", ["build"], {
  stdio: "inherit",
  // `next` is a `.cmd` shim on Windows, which spawn can only launch via a shell.
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
