import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { relativeImports, resolveImport, selectSpecs, testSideClosure } from "./aftersign-e2e-select.mjs";

const repo = (files) => ({
  specs: Object.keys(files).filter((f) => /^aftersign\/e2e\/.+\.spec\.ts$/.test(f)),
  read: (f) => files[f] ?? "",
  exists: (f) => f in files,
});

const FILES = {
  "aftersign/e2e/a.spec.ts": 'import { tap } from "./helpers/gesture";\nimport { copy } from "../src/copy";',
  "aftersign/e2e/b.spec.ts": 'import { contract } from "../../e2e-shared/contract";',
  "aftersign/e2e/c.spec.ts": 'import { test } from "@playwright/test";',
  "aftersign/e2e/helpers/gesture.ts": 'import { wait } from "./wait.js";',
  "aftersign/e2e/helpers/wait.ts": "export const wait = 1;",
  "e2e-shared/contract.ts": "export const contract = 1;",
  "e2e-shared/prod-smoke/save.spec.ts": 'import { test } from "@playwright/test";',
  "aftersign/src/copy.ts": "export const copy = 1;",
};

test("app, package, script, config and lock changes run the full suite", () => {
  for (const file of ["aftersign/main.js", "aftersign/src/copy.ts", "apps/web/src/aftersign/x.ts", "packages/aftersign/src/y.ts", "package-lock.json", "aftersign/playwright.config.ts", "scripts/ci/aftersign-e2e.sh", "scripts/install-playwright-chromium.mjs", ".github/workflows/ci.yml"]) {
    const d = selectSpecs({ changed: ["aftersign/e2e/a.spec.ts", file], ...repo(FILES) });
    assert.equal(d.mode, "all", file);
    assert.match(d.reason, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("a changed spec runs alone; a doc beside it changes nothing", () => {
  const d = selectSpecs({ changed: ["aftersign/e2e/c.spec.ts", "aftersign/docs/notes.md", "README.md"], ...repo(FILES) });
  assert.deepEqual(d, { mode: "some", specs: ["aftersign/e2e/c.spec.ts"], reason: "only test-side files changed; 1 spec(s) can be affected" });
});

test("a changed helper selects every spec that imports it, through other helpers too", () => {
  const direct = selectSpecs({ changed: ["aftersign/e2e/helpers/gesture.ts"], ...repo(FILES) });
  assert.deepEqual(direct.specs, ["aftersign/e2e/a.spec.ts"]);
  const transitive = selectSpecs({ changed: ["aftersign/e2e/helpers/wait.ts"], ...repo(FILES) });
  assert.deepEqual(transitive.specs, ["aftersign/e2e/a.spec.ts"]);
  const shared = selectSpecs({ changed: ["e2e-shared/contract.ts", "aftersign/e2e/c.spec.ts"], ...repo(FILES) });
  assert.deepEqual(shared.specs, ["aftersign/e2e/b.spec.ts", "aftersign/e2e/c.spec.ts"]);
});

test("docs only, or a test file no e2e spec imports, runs no spec", () => {
  assert.equal(selectSpecs({ changed: ["docs/plan.md"], ...repo(FILES) }).mode, "none");
  assert.equal(selectSpecs({ changed: ["e2e-shared/prod-smoke/save.spec.ts"], ...repo(FILES) }).mode, "none");
});

test("fails closed: no list, a deleted helper, a deleted spec's leftovers, an unresolved import", () => {
  assert.equal(selectSpecs({ changed: [], ...repo(FILES) }).mode, "all");
  assert.equal(selectSpecs({ changed: undefined, ...repo(FILES) }).mode, "all");
  assert.equal(selectSpecs({ changed: ["aftersign/e2e/helpers/gone.ts"], ...repo(FILES) }).mode, "all");
  assert.equal(selectSpecs({ changed: ["aftersign/e2e/fixtures/save.json"], ...repo({ ...FILES, "aftersign/e2e/fixtures/save.json": "{}" }) }).mode, "all");
  // A spec that reads a helper by path (no import) is still selected.
  const byPath = { ...FILES, "aftersign/e2e/e.spec.ts": 'const src = readFileSync("e2e-shared/contract.ts", "utf8");' };
  assert.deepEqual(selectSpecs({ changed: ["e2e-shared/contract.ts"], ...repo(byPath) }).specs, ["aftersign/e2e/b.spec.ts", "aftersign/e2e/e.spec.ts"]);
  // A deleted spec alone has nothing to run.
  assert.equal(selectSpecs({ changed: ["aftersign/e2e/gone.spec.ts"], ...repo(FILES) }).mode, "none");
  const broken = { ...FILES, "aftersign/e2e/d.spec.ts": 'import { x } from "./helpers/missing";' };
  assert.equal(selectSpecs({ changed: ["aftersign/e2e/helpers/wait.ts"], ...repo(broken) }).mode, "all");
});

test("imports: static, side-effect, dynamic, require; .js written for a .ts file", () => {
  const src = 'import a from "./a";\nimport "./b.js";\nconst c = await import("../c");\nconst d = require("./d");\nexport { e } from "./e";\nimport x from "pkg";';
  assert.deepEqual(relativeImports(src).sort(), ["../c", "./a", "./b.js", "./d", "./e"]);
  assert.equal(resolveImport("aftersign/e2e/a.spec.ts", "./helpers/wait.js", (f) => f === "aftersign/e2e/helpers/wait.ts"), "aftersign/e2e/helpers/wait.ts");
  assert.equal(resolveImport("aftersign/e2e/a.spec.ts", "./nope", () => false), null);
});

test("the closure stops at app code (a change there already runs everything)", () => {
  const { files, unresolved } = testSideClosure("aftersign/e2e/a.spec.ts", repo(FILES));
  assert.equal(unresolved, false);
  assert.deepEqual([...files].sort(), ["aftersign/e2e/a.spec.ts", "aftersign/e2e/helpers/gesture.ts", "aftersign/e2e/helpers/wait.ts"]);
});

test("the real suite: every import in the test side resolves, so a helper change can narrow the run", () => {
  const list = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? list(`${dir}/${e.name}`) : [`${dir}/${e.name}`]));
  const specs = list("aftersign/e2e").filter((f) => f.endsWith(".spec.ts"));
  assert.ok(specs.length > 100);
  const io = { read: (f) => readFileSync(f, "utf8"), exists: (f) => existsSync(f) };
  const d = selectSpecs({ changed: ["aftersign/e2e/helpers/packetGesture.ts"], specs, ...io });
  assert.equal(d.mode, "some", d.reason);
  assert.ok(d.specs.length >= 1 && d.specs.length < specs.length);
});
