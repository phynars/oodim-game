// Consumer test for the M-CONTINUE-E1 Io continue-beats wiring.
//
// `bootAftersignWindowGame` is the runtime consumer of
// `buildIoContinueBeats` — this jsdom test drives the harness's
// `setIoReturnReason` seam and asserts:
//   1. Before any posture is recorded, `getIoContinueBeats()` returns
//      `null` (no lines to render — the served-page snapshot must not
//      surface a stale reply).
//   2. After `setIoReturnReason(reason)`, `getIoContinueBeats()`
//      returns the two-beat sequence for that posture: Io's REPLY
//      line (posture-specific, sourced from IO_RETURN_TONE_OPTIONS)
//      followed by the invariant NEXT-JOB handoff beat with the red-
//      tag objective.
//   3. Re-striking a different posture re-projects the reply line
//      but leaves the handoff beat identical — same-object identity
//      confirms we're returning the shared frozen constant.
//   4. `setIoReturnReason(null)` clears the sequence — the served
//      surface returns to `null` so no stale voice thread leaks.
//
// Scope guard:
//   - does NOT re-derive posture tokens; the axis is owned by
//     `ioVoiceContract.ts::AftersignReturnReason`.
//   - does NOT re-freeze line strings; `ioContinueBeats.ts` is the
//     data source and its own module is the freeze surface.

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  IO_CONTINUE_BEAT_IDS,
  IO_NEXT_JOB_HANDOFF,
  IO_RETURN_TONE_OPTIONS,
} from "./story/ioContinueBeats";
import "./harness/bootWindowGame";

describe("ioContinueBeats consumer (setIoReturnReason → getIoContinueBeats)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    // Deterministic isolation — the harness is booted at module load
    // (see `harness/bootWindowGame.ts:bootAftersignWindowGame();`).
    window.__game?.setIoReturnReason(null);
  });

  afterEach(() => {
    window.__game?.setIoReturnReason(null);
    document.body.innerHTML = "";
  });

  it("returns null when no posture has been recorded", () => {
    const game = window.__game;
    expect(game).toBeDefined();
    expect(game?.getIoContinueBeats()).toBeNull();
  });

  it("returns the reply + handoff sequence after setIoReturnReason(kind)", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    game?.setIoReturnReason("kind");
    const beats = game?.getIoContinueBeats();
    expect(beats).not.toBeNull();
    expect(beats).toHaveLength(2);

    const kindOption = IO_RETURN_TONE_OPTIONS.find((o) => o.id === "kind");
    expect(kindOption).toBeDefined();

    const [reply, handoff] = beats!;
    expect(reply).toEqual({
      id: IO_CONTINUE_BEAT_IDS.RETURN_TONE_CHOICE,
      speaker: "Io",
      tone: "kind",
      line: kindOption!.reply,
    });
    // The handoff beat is the shared frozen constant — reference
    // identity, not a fresh copy.
    expect(handoff).toBe(IO_NEXT_JOB_HANDOFF);
    expect(handoff.id).toBe(IO_CONTINUE_BEAT_IDS.NEXT_JOB_HANDOFF);
    expect(handoff.objective).toMatch(/red tag/i);
  });

  it("re-projects the reply line but reuses the handoff when the posture changes", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    game?.setIoReturnReason("evasive");
    const firstBeats = game?.getIoContinueBeats();
    expect(firstBeats).not.toBeNull();

    game?.setIoReturnReason("blunt");
    const secondBeats = game?.getIoContinueBeats();
    expect(secondBeats).not.toBeNull();

    const evasiveReply = IO_RETURN_TONE_OPTIONS.find((o) => o.id === "evasive")!
      .reply;
    const bluntReply = IO_RETURN_TONE_OPTIONS.find((o) => o.id === "blunt")!
      .reply;

    expect(firstBeats![0].line).toBe(evasiveReply);
    expect(secondBeats![0].line).toBe(bluntReply);
    expect(firstBeats![0].line).not.toBe(secondBeats![0].line);

    // Handoff is invariant across postures — same reference.
    expect(firstBeats![1]).toBe(IO_NEXT_JOB_HANDOFF);
    expect(secondBeats![1]).toBe(IO_NEXT_JOB_HANDOFF);
  });

  it("clears the sequence when setIoReturnReason(null) is called", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    game?.setIoReturnReason("blunt");
    expect(game?.getIoContinueBeats()).not.toBeNull();

    game?.setIoReturnReason(null);
    expect(game?.getIoContinueBeats()).toBeNull();
  });

  it("each posture in IO_RETURN_TONE_OPTIONS yields a distinct reply line via the harness", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    const seenLines = new Set<string>();
    for (const option of IO_RETURN_TONE_OPTIONS) {
      game?.setIoReturnReason(option.id);
      const beats = game?.getIoContinueBeats();
      expect(beats).not.toBeNull();
      expect(beats![0].line).toBe(option.reply);
      seenLines.add(beats![0].line);
    }
    // Three postures → three distinct reply lines.
    expect(seenLines.size).toBe(IO_RETURN_TONE_OPTIONS.length);
  });
});
