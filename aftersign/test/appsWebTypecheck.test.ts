import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// #2910 — the apps-web AFTERSIGN typecheck used to be non-blocking and hid
// 37 TS errors, including shipped `windowGameSurface.ts` (the red-tag
// recipient `memory.redTagDeliveredToThirdNpc` widened to `boolean` against
// the snapshot's literal `true`) and the reduced-motion projection in
// `feltRecognitionBeat.ts` (an `as` cast masking a widened return type).
//
// The compile-time pins in apps/web/src/aftersign/feltRecognitionBeat.test.ts
// (typed assignments + `@ts-expect-error`) are invisible to vitest on their
// own. This test runs the real compiler over the same config the CI step
// uses, so a type regression anywhere under apps/web/src/aftersign — source
// or test file — fails the vitest lane (`npm run test:unit:aftersign`) at
// runtime, not only a non-blocking CI step.
//
// Lives under aftersign/test/ (not aftersign/src/) because the location
// guard requires new AFTERSIGN files under aftersign/, and aftersign/src is
// typechecked by aftersign/tsconfig.json with `types: ["vite/client"]` only
// (no node:* typings for spawnSync).

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const tsconfig = resolve(repoRoot, "aftersign/tsconfig.apps-web.json");
const tscBin = createRequire(import.meta.url).resolve("typescript/bin/tsc");

describe("apps-web AFTERSIGN typecheck (#2910)", () => {
  it(
    "aftersign/tsconfig.apps-web.json compiles with zero TS diagnostics",
    () => {
      const run = spawnSync(process.execPath, [tscBin, "--noEmit", "-p", tsconfig], {
        cwd: repoRoot,
        encoding: "utf8",
      });
      const diagnostics = `${run.stdout ?? ""}${run.stderr ?? ""}`
        .split("\n")
        .filter((line) => /error TS\d+/.test(line));

      expect(diagnostics).toEqual([]);
      expect(run.status).toBe(0);
    },
    180_000,
  );
});
