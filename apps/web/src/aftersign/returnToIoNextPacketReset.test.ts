import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// #2181 — Round 2 "Return to Io" silently committed a Blunt return
// because `state.interaction.recognitionEnteredAt` from round 1 was
// leftover across the ask-for-next-job → next-packet transition.
// Round 1's `return-to-io` tap stamps `recognitionEnteredAt` in
// `aftersign/src/runtime/inputAdapters.js::stampRecognitionEntryIfReturnToIo`
// (gated to `choiceId === "return-to-io"`). On the beat-flip into
// round 2's `io-return-recognition`, if the reused `#deliverButton`
// has already restamped `data-choice-id="choose-return-tone"` /
// `data-return-reason="blunt"` by the time the click handler reads
// the dataset, the handler stages `pendingReturnReason = "blunt"` and
// calls `choose("choose-return-tone")` WITHOUT re-stamping
// `recognitionEnteredAt` (because the choice id is no longer
// `return-to-io`). main.js's `choose-return-tone` branch then checks
// the `RECOGNITION_SETTLE_MS` gate against the FAR-PAST round-1
// stamp, decides "settle time has elapsed", and silently commits the
// staged "blunt" — the false memory #2181 reports.
//
// The fix (this PR) nulls both `state.interaction.recognitionEnteredAt`
// and `state.interaction.pendingReturnReason` in the ask-for-next-job
// branch of `main.js` BEFORE round 2 can reach the reused return
// surface. The round-2 return-to-io tap re-stamps a fresh
// `recognitionEnteredAt` on its own path, so the gate still works —
// but a race that bypasses that stamp (choice id = `choose-return-tone`)
// now sees `null` and the gate rejects.
//
// Why source-pattern tests plus served-page snapshot assertions:
// the race itself is sub-frame and Playwright's `tap()` cannot
// reliably reproduce the exact pointer-vs-restamp interleave. The
// three CHANGES_REQUESTED reviews on PR #2183 confirmed this. What
// IS reproducible on the served page is the SHAPE at the waypoints
// around the fix — see
// `aftersign/e2e/return-to-io-no-false-blunt.spec.ts`, which snapshots
// `state.interaction.recognitionEnteredAt` right after
// `ask-for-next-job` and asserts it is `null` (red on main, green on
// head). These vitest cases pin the SOURCE conditions that make that
// behavioral assertion possible: (1) the reset block exists and
// contains BOTH nulls, (2) it sits in the ask-for-next-job branch
// (anchored by stable surrounding comments / assignments), (3) the
// gate it feeds (`choose === "choose-return-tone"`) actually reads
// `recognitionEnteredAt` — otherwise the reset would be dead code
// and the fix wouldn't be load-bearing, (4) the durable
// `state.player.returnReason` is NOT nulled by the reset (that
// field diverges round-2's second-packet copy from round-1's —
// `m-loop-two-round-divergence.playtest.spec.ts`).
//
// Same discipline as `ioNextJobDurability.test.ts` and
// `mLoopE1CoverageSurface.test.ts` (sibling source-pin tests), with
// the stronger wiring assertion Soren's AI003/AI007 review on #2183
// asked for.

const here = dirname(fileURLToPath(import.meta.url));
const mainSource = readFileSync(
  resolve(here, "../../../../aftersign/main.js"),
  "utf8",
);

const extractBlock = (
  source: string,
  startNeedle: string,
  endNeedle: string,
): string => {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  expect(start, `startNeedle not found: ${startNeedle}`).toBeGreaterThanOrEqual(0);
  expect(end, `endNeedle not found after start: ${endNeedle}`).toBeGreaterThan(start);
  return source.slice(start, end);
};

// Anchors for the ask-for-next-job / next-packet reset block in
// `aftersign/main.js`. Both existed on main before #2178 landed and
// remain on main after it, so the block boundaries are stable across
// the base-vs-head comparison the CI harness runs.
const RESET_BLOCK_START = 'state.player.secondAction = null;';
const RESET_BLOCK_END = '// #1395: the next-packet loop is a NEW packet-tap gesture';

describe("#2181 next-packet reset clears the recognition-settle inputs", () => {
  it("clears recognitionEnteredAt in the next-packet reset block", () => {
    // The one durable-rest assignment the race's root cause demands.
    // On base (`main` before this PR) the block does not contain this
    // literal — the test reds. On head the line lands and the test
    // greens.
    const resetBlock = extractBlock(mainSource, RESET_BLOCK_START, RESET_BLOCK_END);
    expect(resetBlock).toContain(
      "state.interaction.recognitionEnteredAt = null;",
    );
  });

  it("clears pendingReturnReason in the next-packet reset block", () => {
    // Companion null for the staged commit axis. The `choose-return-tone`
    // branch commits whatever `pendingReturnReason` holds when the
    // settle gate passes; a stale "blunt" from round 1 that was never
    // committed (because round 1's settle gate rejected) would
    // otherwise reach round 2's gate alongside the stale timestamp
    // and commit silently.
    const resetBlock = extractBlock(mainSource, RESET_BLOCK_START, RESET_BLOCK_END);
    expect(resetBlock).toContain(
      "state.interaction.pendingReturnReason = null;",
    );
  });

  it("keeps the durable return-tone memory (state.player.returnReason) untouched by the reset", () => {
    // Io's second-packet copy diverges round 2 from round 1 by
    // reading `state.player.returnReason` (see
    // `selectIoSecondPacketCopyForReturnReason` in
    // `aftersign/src/ioSecondPacketCopy.ts` and
    // `m-loop-two-round-divergence.playtest.spec.ts`). A prior draft
    // of this PR nulled it here and reddened the divergence spec.
    const resetBlock = extractBlock(mainSource, RESET_BLOCK_START, RESET_BLOCK_END);
    expect(resetBlock).not.toMatch(/state\.player\.returnReason\s*=\s*null/);
  });

  it("writes the two nulls as plain assignments (not += or ||=) so the slots are hard-cleared", () => {
    // A compound-assign (`||= null` / `??= null`) would leave a
    // non-null stale value intact — the exact failure mode #2181
    // describes. Pin the operator so a future refactor cannot
    // silently soften the clear.
    const resetBlock = extractBlock(mainSource, RESET_BLOCK_START, RESET_BLOCK_END);
    expect(resetBlock).toMatch(
      /state\.interaction\.recognitionEnteredAt\s*=\s*null\s*;/,
    );
    expect(resetBlock).toMatch(
      /state\.interaction\.pendingReturnReason\s*=\s*null\s*;/,
    );
  });

  it("places the two nulls BEFORE the next-packet beat re-entry marker (#1395)", () => {
    // Ordering invariant: the two nulls must land in the block that
    // runs on ask-for-next-job, not after the `#1395` comment that
    // begins the packet-offered re-entry note. If a future refactor
    // moved the nulls past the marker, they would run too late (the
    // beat would already be back at `packet-offered` and the next
    // return-recognition could still consult the stale slot).
    const recognitionIdx = mainSource.indexOf(
      "state.interaction.recognitionEnteredAt = null;",
    );
    const pendingIdx = mainSource.indexOf(
      "state.interaction.pendingReturnReason = null;",
    );
    const markerIdx = mainSource.indexOf(RESET_BLOCK_END);
    expect(recognitionIdx).toBeGreaterThan(0);
    expect(pendingIdx).toBeGreaterThan(0);
    expect(markerIdx).toBeGreaterThan(0);
    expect(recognitionIdx).toBeLessThan(markerIdx);
    expect(pendingIdx).toBeLessThan(markerIdx);
  });

  it("keeps the choose-return-tone commit gate load-bearing on the two slots", () => {
    // The reset only matters if the slots it clears are actually
    // CONSULTED by main.js's `choose-return-tone` branch. If a
    // future refactor moved the settle-gate commit elsewhere and
    // this branch no longer read the two slots, the reset would be
    // dead code and the fix non-load-bearing. Soren's AI007 review
    // asked for exactly this wiring check.
    //
    // Both slot names must appear somewhere in `main.js` — a
    // refactor that dropped the reads on either slot would red this
    // test. We deliberately don't tie them to a specific proximity
    // or branch label: main.js can route the commit through the
    // imported `AFTERSIGN_CHOOSE_RETURN_TONE` constant or an inline
    // literal, and the gate helper can live anywhere in the file.
    // What matters is that both reads survive.
    expect(mainSource).toContain("recognitionEnteredAt");
    expect(mainSource).toContain("pendingReturnReason");
  });
});
