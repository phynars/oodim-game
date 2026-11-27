import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { check, isSourceModule, unconsumedModules } from "./check-source-consumption.mjs";

const consumer = (path, content) => ({ path, content });

test("rejects the unconsumed source additions behind #2323, #2336, and #2369", () => {
  const added = [
    "apps/web/src/aftersign/aftersignReturnToneRecapCopy.ts",
    "apps/web/src/aftersign/reloadPathPlaceholder.ts",
    "apps/web/src/aftersign/extractedPassThrough.ts",
  ];
  assert.deepEqual(unconsumedModules({ added, consumers: [], packageScripts: [] }), added);
});

test("accepts static, dynamic, and require production consumers without test-only imports", () => {
  const added = ["apps/web/src/aftersign/newCopy.ts", "apps/web/src/aftersign/restore.ts", "apps/web/src/aftersign/registration.ts"];
  const consumers = [
    consumer("apps/web/src/aftersign/main.ts", 'import { copy } from "./newCopy";'),
    consumer("apps/web/src/aftersign/boot.ts", 'await import("./restore");'),
    consumer("apps/web/src/aftersign/bridge.ts", 'require("./registration");'),
  ];
  assert.deepEqual(unconsumedModules({ added, consumers, packageScripts: [] }), []);
  assert.deepEqual(unconsumedModules({ added: [added[0]], consumers: [consumer("apps/web/src/aftersign/newCopy.test.ts", 'import "./newCopy"')], packageScripts: [] }), [added[0]]);
});

test("accepts package-script registration and excludes only test modules from candidates", () => {
  assert.deepEqual(unconsumedModules({ added: ["tools/generate.mjs"], consumers: [], packageScripts: ["node tools/generate.mjs"] }), []);
  assert.equal(isSourceModule("apps/web/src/aftersign/newCopy.test.ts"), false);
  assert.equal(isSourceModule("scripts/new-guard.mjs"), true);
});

test("check reads repository consumers for git-diff additions supplied by the integration", () => {
  const root = mkdtempSync(path.join(tmpdir(), "source-consumption-"));
  mkdirSync(path.join(root, "src"));
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ scripts: {} }));
  writeFileSync(path.join(root, "src", "entry.ts"), 'import "./registered";');
  writeFileSync(path.join(root, "src", "registered.ts"), "export const registered = true;");
  assert.deepEqual(check(root, "unused", ["src/registered.ts"]), []);
  assert.deepEqual(check(root, "unused", ["src/orphan.ts"]), ["src/orphan.ts"]);
});
