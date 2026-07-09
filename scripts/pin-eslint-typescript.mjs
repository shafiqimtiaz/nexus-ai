// Splice a TypeScript v6 Node API into the installed typescript@7 package.
//
// Background: typescript@7 is a native compiler that ships NO programmatic API
// (require("typescript") exposes only `version`). The `tsc` binary shells out to a
// native executable and is unaffected by this script. However, JS tooling such as
// typescript-eslint (and Next.js's build-time type checker) needs the full v6 Node
// API via require("typescript").
//
// This script keeps the native v7 `tsc` binary intact and writes a `lib/typescript.js`
// shim that re-exports the v6 API provided by @typescript/old (a dependency of
// @typescript/typescript6). Two consumers need this:
//   - Next.js's dependency check looks for the physical file `typescript/lib/typescript.js`
//     (exportsRestrict mode), so the file must exist on disk.
//   - require("typescript") / the `typescript` main entry must return the v6 API.
// The shim satisfies both. `tsc --noEmit` / `next build` still compile with the v7 binary.
//
// It is idempotent and safe to run on every install via the "postinstall" script.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function main() {
  const tsPkgPath = resolve(projectRoot, "node_modules/typescript/package.json");
  if (!existsSync(tsPkgPath)) return;

  const tsPkg = JSON.parse(readFileSync(tsPkgPath, "utf8"));
  const major = Number(String(tsPkg.version).split(".")[0]);
  if (major < 7) return; // Not the native TS7 layout; nothing to do.

  // The v6 API source must be present (provided by @typescript/typescript6).
  try {
    require.resolve("@typescript/old/package.json");
  } catch {
    console.warn(
      '[pin-eslint-typescript] @typescript/old not found; skipping v6 API splice. Run "npm install" again.'
    );
    return;
  }

  // The package is `"type": "module"`, so `.js` files are treated as ESM. We therefore
  // use a `.cjs` shim for the loadable v6 API and point the main entry (".") at it.
  const cjsShimPath = resolve(projectRoot, "node_modules/typescript/lib/eslint-typescript.cjs");
  mkdirSync(dirname(cjsShimPath), { recursive: true });
  writeFileSync(cjsShimPath, 'module.exports = require("@typescript/old");\n');

  // Next.js's dependency check requires the physical file `typescript/lib/typescript.js`
  // to exist (it resolves it directly), and `runTypeCheck` then loads it via require().
  // v7 does not ship this file, so we create it as an ESM module that re-exports the
  // same v6 API. (In a `type: module` package a `.js` must be valid ESM, hence the
  // re-export of the `.cjs` shim rather than a `module.exports` statement.)
  const jsShimPath = resolve(projectRoot, "node_modules/typescript/lib/typescript.js");
  mkdirSync(dirname(jsShimPath), { recursive: true });
  writeFileSync(jsShimPath, 'export * from "./eslint-typescript.cjs";\nexport { default } from "./eslint-typescript.cjs";\n');

  const exports = tsPkg.exports || (tsPkg.exports = {});
  if (exports["."] === "./lib/eslint-typescript.cjs") return; // Already spliced.

  // Preserve every other export/subpath (e.g. ./unstable/*) and the "imports" map
  // that `tsc` relies on (#getExePath); only repoint the main entry.
  exports["."] = "./lib/eslint-typescript.cjs";
  writeFileSync(tsPkgPath, JSON.stringify(tsPkg, null, 2) + "\n");

  console.log(
    '[pin-eslint-typescript] require("typescript") -> @typescript/old (v6 API); native tsc remains v7.'
  );
}

main();
