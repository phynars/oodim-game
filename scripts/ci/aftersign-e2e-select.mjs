// Which AFTERSIGN WebGL e2e specs a pull request has to run.
//
// Every spec loads the whole built game, so a change to anything the build or
// the test run reads can break any spec: those PRs run the full suite. Only a
// change that provably cannot reach the build narrows the run:
//
//   a doc (`*.md`, `docs/`, `aftersign/docs/`)       → no spec
//   a spec under aftersign/e2e/                      → that spec
//   a test-side helper (aftersign/e2e/, e2e-shared/) → the specs that import
//                                                      it, directly or through
//                                                      other test-side files,
//                                                      or that name its file
//   anything else, or anything unreadable            → the full suite
//
// A scheduled or manual run is always the full suite. The rule fails closed:
// an unknown file kind, a deleted helper, an import that does not resolve to
// a file, or any error selects everything.
//
// usage: node scripts/ci/aftersign-e2e-select.mjs --out <file>
//   prints `mode=all|some|none` and `reason=…`; with mode=some, <file> holds
//   one spec path per line.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SPEC_DIR = "aftersign/e2e";
const TEST_SIDE = [/^aftersign\/e2e\//, /^e2e-shared\//];
const DOC = [/\.md$/i, /^docs\//, /^aftersign\/docs\//];
const SPEC = /^aftersign\/e2e\/.+\.spec\.ts$/;
const CODE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const EXTENSIONS =["", ".ts", ".js", ".mjs", ".tsx", ".jsx", "/index.ts", "/index.js"];

const isTestSide = (file) => TEST_SIDE.some((re) => re.test(file));
const isDoc = (file) => DOC.some((re) => re.test(file));

/** Relative import specifiers of a source text (static, dynamic, require, re-export). */
export function relativeImports(source) {
  const out = new Set();
  const patterns = [
    /\bfrom\s*["'](\.{1,2}\/[^"']+)["']/g,
    /\bimport\s*["'](\.{1,2}\/[^"']+)["']/g,
    /\bimport\s*\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g,
  ];
  for (const re of patterns) for (const m of source.matchAll(re)) out.add(m[1]);
  return [...out];
}

/** Repo path an import resolves to, or null when no file is there. */
export function resolveImport(fromFile, specifier, exists) {
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier));
  for (const ext of EXTENSIONS) if (exists(base + ext)) return base + ext;
  // `./x.js` written for a `./x.ts` source (TypeScript's ESM spelling).
  const swapped = base.replace(/\.js$/, ".ts");
  if (swapped !== base && exists(swapped)) return swapped;
  return null;
}

/** Every test-side file a spec reaches through relative imports. `unresolved`
 *  is true when an import inside the test side points at no file. */
export function testSideClosure(spec, { read, exists }) {
  const seen = new Set([spec]);
  const queue = [spec];
  let unresolved = false;
  while (queue.length) {
    const file = queue.pop();
    for (const specifier of relativeImports(read(file))) {
      const target = resolveImport(file, specifier, exists);
      if (!target) { unresolved = true; continue; }
      // App and package code is not followed: a change there runs everything.
      if (!isTestSide(target) || seen.has(target)) continue;
      seen.add(target);
      queue.push(target);
    }
  }
  return { files: seen, unresolved };
}

/** Pure decision. `changed` = repo paths the PR touches (added, modified,
 *  deleted; a rename counts as both names). `specs` = spec files at HEAD. */
export function selectSpecs({ changed, specs, read, exists }) {
  const all = (reason) => ({ mode: "all", specs: [], reason });
  if (!Array.isArray(changed) || changed.length === 0) return all("no changed-file list");
  const picked = new Set();
  const helpers = [];
  for (const file of changed) {
    if (isDoc(file)) continue;
    if (SPEC.test(file)) {
      if (exists(file)) picked.add(file);
      continue;
    }
    if (isTestSide(file)) {
      if (!exists(file)) return all(`a test-side file was deleted or renamed: ${file}`);
      // A fixture or other data file is read by path, which imports do not show.
      if (!CODE.test(file)) return all(`a test-side data file changed: ${file}`);
      helpers.push(file);
      continue;
    }
    return all(`the build or the test run can read ${file}`);
  }
  if (helpers.length) {
    for (const spec of specs) {
      const { files, unresolved } = testSideClosure(spec, { read, exists });
      if (unresolved) return all(`an import in ${spec} or its helpers does not resolve to a file`);
      // By import, or by name (a spec that reads a helper's text by path).
      const text = [...files].map((f) => read(f)).join("\n");
      if (helpers.some((h) => files.has(h) || text.includes(path.posix.basename(h)))) picked.add(spec);
    }
  }
  const list = [...picked].sort();
  if (list.length === 0) return { mode: "none", specs: [], reason: "only docs, or test files no e2e spec imports, changed" };
  return { mode: "some", specs: list, reason: `only test-side files changed; ${list.length} spec(s) can be affected` };
}

function listSpecs(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...listSpecs(p));
    else if (SPEC.test(p)) out.push(p);
  }
  return out;
}

function changedFromEvent() {
  if (process.env.GITHUB_EVENT_NAME !== "pull_request") return { reason: "not a pull request: the full suite runs" };
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const base = event.pull_request?.base?.sha;
  const head = event.pull_request?.head?.sha;
  if (!base || !head) return { reason: "the event names no base and head commit" };
  const text = execFileSync("git", ["diff", "--name-only", "--no-renames", `${base}...${head}`], { encoding: "utf8" });
  return { changed: text.split("\n").map((l) => l.trim()).filter(Boolean) };
}

function main() {
  const i = process.argv.indexOf("--out");
  const outFile = i === -1 ? null : process.argv[i + 1];
  let decision;
  try {
    const { changed, reason } = changedFromEvent();
    decision = changed
      ? selectSpecs({ changed, specs: listSpecs(SPEC_DIR), read: (f) => readFileSync(f, "utf8"), exists: (f) => existsSync(f) })
      : { mode: "all", specs: [], reason };
  } catch (err) {
    decision = { mode: "all", specs: [], reason: `selection failed (${String(err?.message ?? err).split("\n")[0]})` };
  }
  if (outFile) writeFileSync(outFile, decision.specs.map((s) => s + "\n").join(""));
  console.log(`mode=${decision.mode}`);
  console.log(`reason=${decision.reason}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
