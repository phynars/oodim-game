// Consumer wiring for `aftersign/src/ioLoopConsequenceCopy.js`
// (#1765 review — Soren, Mara, phynars-oodim).
//
// The prior three REQUEST_CHANGES all said the same thing: the copy
// module compiled but had zero shipped-surface importers. A green
// test on the pure selector couldn't approve a module the game never
// reads. This spec closes that gap.
//
// `harness/bootWindowGame.ts` now imports `ioLoopConsequenceLine` and
// folds the chosen sentence into the served-page snapshot at
// `story.nextJob.offer.consequenceLine` alongside the existing `copy`
// projection. The three memory branches the JS module declares
// (`sealed` / `opened` / `pending`) each map to a distinct
// vertical-slice `packetOutcome`; this test drives all three through
// the harness surface and asserts the strings arrive verbatim.
//
// If a future refactor unwires the copy selector from
// `bootWindowGame.ts`, THIS assertion goes red and the module stops
// pretending to ship.
//
// Runs in the aftersign vitest blocking lane (registered in
// `vitest.config.ts`) so PR CI enforces the wire.

import { describe, expect, it } from "vitest";

import {
  IO_LOOP_CONSEQUENCE_COPY,
  ioLoopConsequenceLine,
} from "../../../../aftersign/src/ioLoopConsequenceCopy.js";
import {
  createAftersignVerticalSliceState,
  encodeAftersignDurableSave,
  meetIoForAftersignSlice,
  recordAftersignPacketChoice,
} from "./verticalSliceState";
import "./harness/bootWindowGame";

describe("ioLoopConsequenceLine consumer (window.__game wiring)", () => {
  it("exposes three distinct outcome branches with populated lines", () => {
    const lines = [
      IO_LOOP_CONSEQUENCE_COPY.sealed,
      IO_LOOP_CONSEQUENCE_COPY.opened,
      IO_LOOP_CONSEQUENCE_COPY.pending,
    ];
    for (const line of lines) {
      expect(typeof line).toBe("string");
      expect(line.length).toBeGreaterThan(0);
    }
    // No two branches collapse to the same sentence — the point of
    // the module is that the previous run leaves a distinguishable
    // mark on this run's opening line.
    expect(new Set(lines).size).toBe(3);
  });

  it("returns the pending line for a fresh boot (no packet outcome recorded)", () => {
    expect(ioLoopConsequenceLine(undefined)).toBe(
      IO_LOOP_CONSEQUENCE_COPY.pending,
    );
    expect(ioLoopConsequenceLine(null)).toBe(IO_LOOP_CONSEQUENCE_COPY.pending);
    expect(ioLoopConsequenceLine("pending")).toBe(
      IO_LOOP_CONSEQUENCE_COPY.pending,
    );
    // Unknown outcomes fall through to pending — never leak a raw key
    // into the served surface.
    expect(ioLoopConsequenceLine("something-else")).toBe(
      IO_LOOP_CONSEQUENCE_COPY.pending,
    );
  });

  it("returns the sealed line when the player delivered a sealed packet", () => {
    expect(ioLoopConsequenceLine("sealed")).toBe(
      IO_LOOP_CONSEQUENCE_COPY.sealed,
    );
  });

  it("returns the opened line when the player opened the packet", () => {
    expect(ioLoopConsequenceLine("opened")).toBe(
      IO_LOOP_CONSEQUENCE_COPY.opened,
    );
  });

  // The heart of the review: the pure selector reaches the served
  // snapshot. Fresh boot → pending. Sealed delivery → sealed line.
  // Opened packet → opened line. If any of these fails, the module
  // is dead code and the reviewers are correct to block merge.

  it("projects the pending line through the harness snapshot on a fresh boot", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1),
    );
    game?.acceptNextJob();

    const offer = game?.getSnapshot().story.nextJob?.offer as
      | { consequenceLine?: unknown }
      | undefined;
    expect(offer?.consequenceLine).toBe(IO_LOOP_CONSEQUENCE_COPY.pending);
  });

  it("projects the sealed line when the player delivered the packet closed", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    game?.restoreDurableSave(
      encodeAftersignDurableSave(
        meetIoForAftersignSlice(
          recordAftersignPacketChoice(
            createAftersignVerticalSliceState(),
            "sealed",
          ),
        ),
        4,
      ),
    );
    game?.acceptNextJob();

    const offer = game?.getSnapshot().story.nextJob?.offer as
      | { consequenceLine?: unknown }
      | undefined;
    expect(offer?.consequenceLine).toBe(IO_LOOP_CONSEQUENCE_COPY.sealed);
    // Cross-check: the pure selector called with the same axis
    // returns the same line — proves the harness calls THIS
    // primitive, not authoring copy inline.
    expect(offer?.consequenceLine).toBe(ioLoopConsequenceLine("sealed"));
  });

  it("projects the opened line when the player opened the packet", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    game?.restoreDurableSave(
      encodeAftersignDurableSave(
        meetIoForAftersignSlice(
          recordAftersignPacketChoice(
            createAftersignVerticalSliceState(),
            "opened",
          ),
        ),
        6,
      ),
    );
    game?.acceptNextJob();

    const offer = game?.getSnapshot().story.nextJob?.offer as
      | { consequenceLine?: unknown }
      | undefined;
    expect(offer?.consequenceLine).toBe(IO_LOOP_CONSEQUENCE_COPY.opened);
    expect(offer?.consequenceLine).toBe(ioLoopConsequenceLine("opened"));
  });

  it("keeps the pending and sealed lines divergent on the served surface", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1),
    );
    game?.acceptNextJob();
    const pendingLine = (
      game?.getSnapshot().story.nextJob?.offer as
        | { consequenceLine?: string }
        | undefined
    )?.consequenceLine;

    game?.restoreDurableSave(
      encodeAftersignDurableSave(
        meetIoForAftersignSlice(
          recordAftersignPacketChoice(
            createAftersignVerticalSliceState(),
            "sealed",
          ),
        ),
        4,
      ),
    );
    game?.acceptNextJob();
    const sealedLine = (
      game?.getSnapshot().story.nextJob?.offer as
        | { consequenceLine?: string }
        | undefined
    )?.consequenceLine;

    expect(pendingLine).toBeTruthy();
    expect(sealedLine).toBeTruthy();
    expect(sealedLine).not.toBe(pendingLine);
  });

  // JSON serialisability guard — the line must survive a
  // postMessage/localStorage round-trip a scene renderer might stage.
  it("keeps the consequenceLine JSON-serialisable end-to-end", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    game?.restoreDurableSave(
      encodeAftersignDurableSave(
        meetIoForAftersignSlice(
          recordAftersignPacketChoice(
            createAftersignVerticalSliceState(),
            "sealed",
          ),
        ),
        2,
      ),
    );
    game?.acceptNextJob();

    const snapshot = game?.getSnapshot();
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});
