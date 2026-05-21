/**
 * Runs after `next build` to assemble the Tauri resource bundle.
 *
 * Outputs:
 *   src-tauri/server/   ← Next.js standalone server + static/public assets
 *   src-tauri/binaries/node-x86_64-unknown-linux-gnu  ← this Node.js binary
 *
 * Usage (via beforeBuildCommand in tauri.conf.json):
 *   pnpm exec next build && node scripts/prepare-bundle.mjs
 */

import { copyFileSync, mkdirSync, cpSync, rmSync, readdirSync, existsSync, chmodSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, ".."); // apps/web/
const tauriDir = join(appRoot, "src-tauri");

const standaloneDir = join(appRoot, ".next", "standalone");
if (!existsSync(standaloneDir)) {
  console.error("ERROR: .next/standalone not found — did `next build` complete with output: 'standalone'?");
  process.exit(1);
}

// 1. Copy standalone server output
const serverDestDir = join(tauriDir, "server");
if (existsSync(serverDestDir)) {
  rmSync(serverDestDir, { recursive: true, force: true });
}
// dereference: true converts symlinks to real copies — required so that
// the Tauri AppImage bundle doesn't contain dangling absolute symlinks.
cpSync(standaloneDir, serverDestDir, { recursive: true, dereference: true });

// 2. Static assets — in a pnpm monorepo the standalone tree mirrors the repo
//    structure, so static files must land at apps/web/.next/static/ within it.
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

// 5. Remove sharp's bundled .so files wherever they land (top-level .pnpm
//    packages and nested copies inside sharp@x itself). These trip linuxdeploy
//    during AppImage builds. Next.js falls back to its built-in image optimizer.
// Remove every pnpm store entry whose name starts with a sharp/img prefix.
const pnpmVStore = join(serverDestDir, "node_modules", ".pnpm");
if (existsSync(pnpmVStore)) {
  const sharpPrefixes = ["@img+sharp", "sharp@", "sharp-linux", "sharp-libvips"];
  for (const entry of readdirSync(pnpmVStore)) {
    if (sharpPrefixes.some((p) => entry.startsWith(p))) {
      rmSync(join(pnpmVStore, entry), { recursive: true, force: true });
    }
  }
}
// Belt-and-suspenders: remove any stray .so files that reference libvips/sharp
// anywhere in the tree (e.g. nested inside other packages).
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

// 6. Bundle the running Node.js binary as the Tauri sidecar
const binariesDir = join(tauriDir, "binaries");
mkdirSync(binariesDir, { recursive: true });
const nodeDest = join(binariesDir, "node-x86_64-unknown-linux-gnu");
copyFileSync(process.execPath, nodeDest);
chmodSync(nodeDest, 0o755);

console.log("✓ Bundle prepared");
console.log(`  server  → ${serverDestDir}`);
console.log(`  node    → ${nodeDest}`);
console.log(`  (node ${process.version} from ${process.execPath})`);
