/**
 * Runs after `next build` to assemble the Tauri resource bundle.
 *
 * Outputs:
 *   src-tauri/server/   ← Next.js standalone server + static/public assets
 *   src-tauri/binaries/node-<triple>[.exe]  ← this Node.js binary
 *
 * Usage (via beforeBuildCommand in tauri.conf.json):
 *   pnpm exec next build && node scripts/prepare-bundle.mjs
 */

import { copyFileSync, mkdirSync, cpSync, rmSync, readdirSync, existsSync, chmodSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { platform, arch } from "node:os";
import { execSync } from "node:child_process";

console.log("prepare-bundle: starting, cwd =", process.cwd());
console.log("prepare-bundle: platform =", platform(), arch());

function getTauriTargetTriple() {
  const p = platform();
  const a = arch();
  if (p === "linux"  && a === "x64")   return "x86_64-unknown-linux-gnu";
  if (p === "linux"  && a === "arm64") return "aarch64-unknown-linux-gnu";
  if (p === "darwin" && a === "arm64") return "aarch64-apple-darwin";
  if (p === "darwin" && a === "x64")   return "x86_64-apple-darwin";
  if (p === "win32"  && a === "x64")   return "x86_64-pc-windows-msvc";
  throw new Error(`Unsupported platform: ${p} ${a}`);
}

// Robocopy-backed directory copy for Windows — handles NTFS junction points
// and exits codes 0-7 which robocopy uses to signal success+stats.
function winCopy(src, dest) {
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  try {
    execSync(
      `robocopy "${src}" "${dest}" /E /SL /COPYALL /NFL /NDL /NJH /NJS /NC /NS /NP`,
      { stdio: "inherit" }
    );
  } catch (err) {
    // robocopy exits 1–7 for various success states; only >=8 is a real error.
    if (!err.status || err.status >= 8) throw err;
  }
}

function safeCpSync(src, dest, opts) {
  if (platform() === "win32") {
    winCopy(src, dest);
  } else {
    cpSync(src, dest, { recursive: true, dereference: true, ...opts });
  }
}

try {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const appRoot = join(__dirname, ".."); // apps/web/
  const tauriDir = join(appRoot, "src-tauri");

  const standaloneDir = join(appRoot, ".next", "standalone");
  if (!existsSync(standaloneDir)) {
    console.error("ERROR: .next/standalone not found — did `next build` complete with output: 'standalone'?");
    process.exit(1);
  }
  console.log("prepare-bundle: standalone dir found");

  // 1. Copy standalone server output
  const serverDestDir = join(tauriDir, "server");
  console.log("prepare-bundle: copying standalone →", serverDestDir);
  safeCpSync(standaloneDir, serverDestDir, {});
  console.log("prepare-bundle: standalone copy done");

  // 1b. Fix pnpm symlinks in apps/web/node_modules — Next.js standalone with pnpm
  //     produces relative symlinks (next → ../../../.pnpm/...); cpSync turns them
  //     into absolute symlinks pointing into the source tree. Tauri's DEB bundler
  //     skips symlinks entirely, so next/react never make it into the package.
  //     Replace each symlink with a real copy dereferenced from the pnpm store.
  const appWebModulesDir = join(serverDestDir, "apps", "web", "node_modules");
  if (existsSync(appWebModulesDir)) {
    for (const entry of readdirSync(appWebModulesDir, { withFileTypes: true })) {
      if (!entry.isSymbolicLink()) continue;
      const linkPath = join(appWebModulesDir, entry.name);
      const realTarget = realpathSync(linkPath);
      rmSync(linkPath, { recursive: true, force: true });
      cpSync(realTarget, linkPath, { recursive: true, dereference: true });
      console.log(`  resolved symlink: apps/web/node_modules/${entry.name}`);
    }
  }

  // 1c. Hoist pnpm virtual store → flat server/node_modules so next and its runtime
  //     deps (styled-jsx, busboy, @next/env, etc.) resolve via standard Node.js
  //     module resolution. The standalone output puts everything in .pnpm/ but
  //     omits the top-level hoisted symlinks that pnpm normally creates.
  const pnpmVirtualStore = join(serverDestDir, "node_modules", ".pnpm");
  const rootNodeModules = join(serverDestDir, "node_modules");
  if (existsSync(pnpmVirtualStore)) {
    console.log("prepare-bundle: hoisting pnpm virtual store...");
    for (const storeEntry of readdirSync(pnpmVirtualStore)) {
      const innerMods = join(pnpmVirtualStore, storeEntry, "node_modules");
      if (!existsSync(innerMods)) continue;
      for (const entry of readdirSync(innerMods, { withFileTypes: true })) {
        if (entry.name.startsWith(".")) continue;
        const srcPath = join(innerMods, entry.name);
        if (entry.name.startsWith("@")) {
          const scopeDestDir = join(rootNodeModules, entry.name);
          if (!existsSync(scopeDestDir)) mkdirSync(scopeDestDir, { recursive: true });
          for (const scoped of readdirSync(srcPath, { withFileTypes: true })) {
            if (scoped.name.startsWith(".")) continue;
            const scopedDest = join(scopeDestDir, scoped.name);
            if (!existsSync(scopedDest)) {
              cpSync(join(srcPath, scoped.name), scopedDest, { recursive: true, dereference: true });
            }
          }
        } else {
          const destPath = join(rootNodeModules, entry.name);
          if (!existsSync(destPath)) {
            cpSync(srcPath, destPath, { recursive: true, dereference: true });
          }
        }
      }
    }
    console.log("  pnpm store hoisted → server/node_modules/");
  }

  // 2. Static assets — in a pnpm monorepo the standalone tree mirrors the repo
  //    structure, so static files must land at apps/web/.next/static/ within it.
  console.log("prepare-bundle: copying static assets...");
  cpSync(
    join(appRoot, ".next", "static"),
    join(serverDestDir, "apps", "web", ".next", "static"),
    { recursive: true }
  );

  // 3. Public dir — same nesting
  const publicDir = join(appRoot, "public");
  if (existsSync(publicDir)) {
    cpSync(publicDir, join(serverDestDir, "apps", "web", "public"), { recursive: true });
  }

  // 4. Copy better-sqlite3 (+ its runtime deps) — Next.js standalone doesn't
  //    trace native addons from workspace packages automatically.
  console.log("prepare-bundle: copying native modules...");
  const workspaceRoot = join(appRoot, "..", "..");
  const pnpmStore = join(workspaceRoot, "node_modules", ".pnpm");
  const nativeModules = [
    {
      src: join(pnpmStore, "better-sqlite3@12.10.0", "node_modules", "better-sqlite3"),
      dest: join(serverDestDir, "node_modules", "better-sqlite3"),
    },
    {
      src: join(pnpmStore, "bindings@1.5.0", "node_modules", "bindings"),
      dest: join(serverDestDir, "node_modules", "bindings"),
    },
    {
      src: join(pnpmStore, "file-uri-to-path@1.0.0", "node_modules", "file-uri-to-path"),
      dest: join(serverDestDir, "node_modules", "file-uri-to-path"),
    },
  ];
  for (const { src, dest } of nativeModules) {
    if (existsSync(src)) {
      if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
      cpSync(src, dest, { recursive: true, dereference: true });
    } else {
      console.warn(`WARN: native module not found at ${src}`);
    }
  }

  // 5. Remove sharp's platform-specific native libs wherever they land.
  //    On Linux these trip linuxdeploy during AppImage builds (.so files).
  //    On Windows Tauri's bundler can get confused by stray sharp .dll files.
  //    Next.js falls back to its built-in image optimizer when sharp is absent.
  if (platform() !== "win32") {
    const pnpmVStore = join(serverDestDir, "node_modules", ".pnpm");
    if (existsSync(pnpmVStore)) {
      const sharpPrefixes = ["@img+sharp", "sharp@", "sharp-linux", "sharp-libvips"];
      for (const entry of readdirSync(pnpmVStore)) {
        if (sharpPrefixes.some((p) => entry.startsWith(p))) {
          rmSync(join(pnpmVStore, entry), { recursive: true, force: true });
        }
      }
    }
    function removeVipsLibs(dir) {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          removeVipsLibs(full);
        } else if (
          (entry.name.endsWith(".so") || entry.name.includes(".so.")) &&
          (full.includes("libvips") || full.includes("sharp"))
        ) {
          rmSync(full, { force: true });
        }
      }
    }
    removeVipsLibs(join(serverDestDir, "node_modules"));
  }

  // 6. Bundle the running Node.js binary as the Tauri sidecar
  console.log("prepare-bundle: copying node binary...");
  const binariesDir = join(tauriDir, "binaries");
  mkdirSync(binariesDir, { recursive: true });
  const targetTriple = getTauriTargetTriple();
  const ext = platform() === "win32" ? ".exe" : "";
  const nodeDest = join(binariesDir, `node-${targetTriple}${ext}`);
  copyFileSync(process.execPath, nodeDest);
  if (platform() !== "win32") chmodSync(nodeDest, 0o755);

  console.log("✓ Bundle prepared");
  console.log(`  server  → ${serverDestDir}`);
  console.log(`  node    → ${nodeDest}`);
  console.log(`  (node ${process.version} from ${process.execPath} [${targetTriple}])`);
} catch (err) {
  console.error("prepare-bundle FAILED:", err.message);
  console.error(err.stack);
  process.exit(1);
}
