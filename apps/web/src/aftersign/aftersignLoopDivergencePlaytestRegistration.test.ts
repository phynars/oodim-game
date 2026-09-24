import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Sibling guard for `aftersignLoopDivergencePlaytestSurface.test.ts`.
//
// The surface test proves the M-LOOP played-acceptance witness on the served
// page. It cannot, however, prove its own body: if someone silently hollows
// it out (deletes the `provesTwoPlayedRounds` check, swaps the `it` for
// `it.skip`, or replaces the assertion with `expect(true).toBe(true)`), the
// include-list entry keeps passing green and the M-LOOP guard is gone with
// no red anywhere to catch it.
//
// This file reads the surface file's SOURCE and asserts the load-bearing
// pieces are still there. It intentionally asserts things the surface test
// structurally cannot: (1) that the surface file contains an unskipped
// assertion on `provesTwoPlayedRounds`, and (2) that the served-page witness
// (`data-offer-fingerprint` stamp + `fingerprintJobOfferAction` import)
// is asserted against `aftersign/main.js`. If either is deleted, this test
// reds — and that's the whole point.

// Resolve the sibling surface file from cwd, not `import.meta.url` — under
// the CI vitest runner `import.meta.url` isn't guaranteed to be a `file:`
// URL, and `readFileSync` on a non-file URL throws ERR_INVALID_URL_SCHEME,
// which would make this guard silently absent. The surface test next to us
// already solved cwd-independence by walking up to find `aftersign/e2e`;
// we do the same thing to find the repo root, then join through
// `apps/web/src/aftersign/`. Works from both the repo-root and the
// apps/web vitest invocations.
function findRepoRoot(start: string): string {
  let directory = resolve(start);
  while (dirname(directory) !== directory) {
    if (existsSync(join(directory, "aftersign", "e2e"))) return directory;
    directory = dirname(directory);
  }
  throw new Error("Could not find the repository-root aftersign/e2e directory.");
}

const REPO_ROOT = findRepoRoot(process.cwd());
const SURFACE_TEST_PATH = join(
  REPO_ROOT,
  "apps",
  "web",
  "src",
  "aftersign",
  "aftersignLoopDivergencePlaytestSurface.test.ts",
);
const surfaceSource = readFileSync(SURFACE_TEST_PATH, "utf8");

describe("M-LOOP divergence played-acceptance surface — body guard", () => {
  it("asserts a discovered playtest satisfies provesTwoPlayedRounds (not merely matchesLoopDivergencePlaytest)", () => {
    // The stricter witness — two completed rounds via visible taps — is what
    // separates "phone spec exists" from "player actually played the loop".
    // If the surface test drops back to the looser gate, this reds.
    expect(surfaceSource).toMatch(
      /playtests\.find\(\s*\(\s*\{\s*source\s*\}\s*\)\s*=>\s*provesTwoPlayedRounds\(\s*source\s*\)\s*\)/,
    );
    expect(surfaceSource).toMatch(
      /expect\(\s*fullLoopPlaytest\?\.path\s*\)\.toBeDefined\(\s*\)/,
    );
  });

  it("asserts the served-page divergent-offer witness is wired in aftersign/main.js", () => {
    // The played-acceptance surface is only meaningful if the divergent
    // fingerprint is stamped on the actual served button. If the surface
    // test drops the main.js assertions, the E2E spec could pass against a
    // page that never renders divergent tappable actions.
    expect(surfaceSource).toContain(
      'import { fingerprintJobOfferAction } from "../packages/aftersign/src/jobOfferActionFingerprint"',
    );
    expect(surfaceSource).toContain('"data-offer-fingerprint"');
    expect(surfaceSource).toContain("fingerprintJobOfferAction(offer).semanticKey");
  });

  it("keeps the surface `it` blocks unskipped", () => {
    // A `.skip` / `.todo` on either M-LOOP surface case turns the guard into
    // a silent green. This reds if that ever happens.
    expect(surfaceSource).not.toMatch(/\bit\.(?:skip|todo)\s*\(/);
    expect(surfaceSource).not.toMatch(/\bdescribe\.(?:skip|todo)\s*\(/);
  });
});
