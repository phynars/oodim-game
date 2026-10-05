import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// #2181 — Round 2 "Return to Io" silently committed a Blunt return because
// `state.interaction.recognitionEnteredAt` from round 1 was leftover
// across the next-packet reset. On the beat flip into round 2's
// `io-return-recognition`, the settle gate in main.js's
// `choose === "choose-return-tone"` branch read a FAR-PAST
// `recognitionEnteredAt` (stamped by round 1's `return-to-io` tap),
// decided "settle time has elapsed", and committed whatever
// `pendingReturnReason` the beat-flip race staged — in the reported
// playtest, "blunt" from the re-stamped `#deliverButton`.
//
// This source-pattern test pins the fix at the ONE site Soren's
// AI003/AI007 reviews on PR #2183 asked for a demonstrable red: the
// `ask-for-next-job`/next-packet branch of `aftersign/main.js` must
// explicitly null BOTH `state.interaction.pendingReturnReason` AND
// `state.interaction.recognitionEnteredAt` before the beat can reach
// the reused return surface again.
//
// Why source-pattern instead of a Playwright red-on-base spec: the
// bug is a sub-frame race between a physical pointerup and the
// `data-choice-id` / `data-return-reason` re-stamp on `#deliverButton`.
// Playwright's `tap()` fires discrete events that don't participate in
// that race — see the three CHANGES_REQUESTED reviews on #2183 — so a
// `tap()`-driven round-2 spec can't be made to fail on base. The
// DURABLE REST SURFACE this fix touches (the two null-assignments in
// main.js) IS checkable at the source level and fails deterministically
// on `main` where neither line exists. Same discipline as
// `ioNextJobDurability.test.ts` and `mLoopE1CoverageSurface.test.ts`
// (sibling source-pin tests in this directory).

const here = dirname(fileURLToPath(import.meta.url));
const mainSource = readFileSync(
  resolve(here, "../../../../aftersign/main.js"),
  "utf8",
);

const extractBlock = (source: string, startNeedle: string, endNeedle: string) => {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  expect(start, `startNeedle not found: ${startNeedle}`).toBeGreaterThanOrEqual(0);
  expect(end, `endNeedle not found after start: ${endNeedle}`).toBeGreaterThan(start);
  return source.slice(start, end);
};

describe("#2181 next-packet reset clears the recognition-settle inputs", () => {
  it("clears the transient return-tone interaction before the next packet can reach the reused return surface", () => {
    // The next-packet branch sits between the delivery-outcome reset
    // (`state.delivery.outcome = "unknown"`) and the `#1395` comment
    // that begins the ask-for-next-job re-entry note. Both anchors are
    // stable: they existed on main before #2178 and after.
    const nextPacketResetBlock = extractBlock(
      mainSource,
      'state.player.secondAction = null;',
      '// #1395: the next-packet loop is a NEW packet-tap gesture',
    );

    // The two durable-rest assignments the fix adds. On base (`main`
    // before this PR), neither line exists in this block — the test
    // reds. On head, both land and the test is green.
    expect(nextPacketResetBlock).toContain(
      "state.interaction.pendingReturnReason = null;",
    );
    expect(nextPacketResetBlock).toContain(
      "state.interaction.recognitionEnteredAt = null;",
    );
  });

  it("keeps the durable return-tone memory (state.player.returnReason) untouched by the reset", () => {
    // Io's second-packet copy diverges round 2 from round 1 by reading
    // `state.player.returnReason` (see `selectIoSecondPacketCopyForReturnReason`
    // in `aftersign/src/ioSecondPacketCopy.ts` and
    // `m-loop-two-round-divergence.playtest.spec.ts`). The reset must
    // NOT null this slot — a prior draft of #2183 did and reddened the
    // divergence spec. Pin the absence of that regression at the same
    // source site.
    const nextPacketResetBlock = extractBlock(
      mainSource,
      'state.player.secondAction = null;',
      '// #1395: the next-packet loop is a NEW packet-tap gesture',
    );

    expect(nextPacketResetBlock).not.toMatch(/state\.player\.returnReason\s*=\s*null/);
  });
});
