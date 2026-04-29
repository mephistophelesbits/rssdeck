/**
 * afterPack.js — electron-builder post-pack hook
 *
 * Removes build-time-only native modules that electron-builder auto-detects
 * from root node_modules and incorrectly bundles into the app:
 *
 *   @next/swc-*          — Next.js Rust compiler (build tool, ~112 MB)
 *   @img/sharp-*         — Image optimizer (not needed for pre-built app, ~16 MB)
 *   @swc/*               — SWC core (build tool)
 *
 * These are safe to remove because:
 *   - The app ships a pre-built .next/standalone server — no compilation at runtime
 *   - next/image optimization is not used server-side in this Electron deployment
 */

const path = require('path');
const fs = require('fs');

exports.default = async (context) => {
  const { appOutDir, packager } = context;
  const appName = packager.appInfo.productFilename;

  // Resolve the asar.unpacked node_modules path for each platform
  const unpackedDir = process.platform === 'darwin'
    ? path.join(appOutDir, `${appName}.app`, 'Contents', 'Resources', 'app.asar.unpacked', 'node_modules')
    : path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules');

  if (!fs.existsSync(unpackedDir)) return;

  const targets = fs.readdirSync(unpackedDir).filter(name =>
    name === '@next' || name === '@img' || name === '@swc'
  );

  for (const target of targets) {
    const fullPath = path.join(unpackedDir, target);
    const before = dirSizeMB(fullPath);
    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log(`  afterPack: removed ${target}/ (${before} MB saved)`);
  }
};

function dirSizeMB(dir) {
  try {
    let total = 0;
    const walk = (d) => {
      for (const f of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, f.name);
        if (f.isDirectory()) walk(p);
        else total += fs.statSync(p).size;
      }
    };
    walk(dir);
    return (total / 1024 / 1024).toFixed(0);
  } catch {
    return '?';
  }
}
