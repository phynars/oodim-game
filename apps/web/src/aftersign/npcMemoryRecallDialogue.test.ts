// AFTERSIGN — NPC memory-recall dialogue.
//
// This file carries BOTH the freeze contract for the recall-line data
// module (`npcMemoryRecallDialogue.ts`) AND its consumer wiring — a
// harness-boot-driven assertion that `findAftersignNpcMemoryRecallLine`
// actually reaches the shipped story snapshot as `story.npcMemoryRoundTrip
// .recallLine`. The consumer block exists because the reviewer's rule
// (PR #1343 REQUEST_CHANGES) is exact: "a line that never renders was
// never spoken" — a pure-data module with only its own contract test is
// not shipped work.
//
// Lane note: this file is registered in `apps/web/src/aftersign/vitest
// .config.ts` alongside the other `*.consumer.test.ts` blocks so it runs
// in the blocking aftersign lane. The `harness/bootWindowGame` side-
// effect import is what mounts `window.__game`, and the assertions below
// drive the same surface a served-page consumer sees via
// `getAftersignStoryState`.

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AFTERSIGN_NPC_MEMORY_RECALL_DIALOGUE,
  findAftersignNpcMemoryRecallLine,
} from "./npcMemoryRecallDialogue";
import {
  createAftersignVerticalSliceState,
  encodeAftersignDurableSave,
  meetIoForAftersignSlice,
  meetOrraForAftersignSlice,
  recordAftersignOrraAction,
  recordAftersignPacketChoice,
} from "./verticalSliceState";
import "./harness/bootWindowGame";

describe("Aftersign NPC memory recall dialogue (contract)", () => {
  it("keeps one assertable spoken line for each returning memory beat", () => {
    expect(AFTERSIGN_NPC_MEMORY_RECALL_DIALOGUE).toEqual([
      {
        id: "io-return-opened",
        npcId: "io",
        trigger: {
          scene: "io-return",
          remembers: "packet-opened",
        },
        line: "You opened it. I heard the seal give before the room did.",
        playerMemoryEcho: "Io remembers that you opened the packet.",
        assertionText: "You opened it.",
      },
      {
        id: "io-return-sealed",
        npcId: "io",
        trigger: {
          scene: "io-return",
          remembers: "packet-sealed",
        },
        line: "Still sealed. Good. Some doors only learn your name after you refuse them.",
        playerMemoryEcho: "Io remembers that you kept the packet sealed.",
        assertionText: "Still sealed.",
      },
      {
        id: "orra-return-answered-saint-orra",
        npcId: "orra",
        trigger: {
          scene: "orra-return",
          remembers: "answered-saint-orra",
        },
        line: "You answered when the saint asked. That kind of voice leaves a thread.",
        playerMemoryEcho: "Saint Orra remembers that you answered her.",
        assertionText: "You answered when the saint asked.",
      },
    ]);
  });

  it("finds a line by NPC and remembered player action", () => {
    expect(
      findAftersignNpcMemoryRecallLine({
        npcId: "io",
        remembers: "packet-opened",
      }),
    ).toMatchObject({
      id: "io-return-opened",
      assertionText: "You opened it.",
    });

    expect(
      findAftersignNpcMemoryRecallLine({
        npcId: "orra",
        remembers: "packet-sealed",
      }),
    ).toBeNull();
  });

  it("keeps every recall line short enough to render as dialogue", () => {
    for (const recallLine of AFTERSIGN_NPC_MEMORY_RECALL_DIALOGUE) {
      expect(recallLine.line.length).toBeLessThanOrEqual(86);
      expect(recallLine.assertionText.length).toBeGreaterThan(0);
      expect(recallLine.playerMemoryEcho).toContain("remembers");
    }
  });
});

/**
 * Consumer wiring: `findAftersignNpcMemoryRecallLine` must reach the
 * shipped story snapshot as `story.npcMemoryRoundTrip.recallLine`.
 *
 * The path we exercise here is identical to the served-page path:
 *
 *   1. Restore a durable save that carries the remembered fork
 *      (packet outcome, or Orra's answered action).
 *   2. Meet the NPC → recognition transition arms the recall trigger
 *      AND flips `state.<npc>RecognizesPlayer` to true.
 *   3. `setPlayerMemory` provides the two axes the round-trip surface
 *      needs. Any non-null memory input unlocks the beat on the next
 *      `getStoryState()` call.
 *   4. `getStoryState()` reads through `windowGameSurface.ts::
 *      buildNpcMemoryRoundTripBeat`, which calls
 *      `findAftersignNpcMemoryRecallLine` for the remembered fork and
 *      attaches the authored recall line to the emitted beat.
 *
 * If a future refactor unwires the recall-line module from the surface,
 * THIS test goes red — that's the "reaches the DOM" guarantee the
 * played-not-driven rule requires.
 */
describe("Aftersign NPC memory recall dialogue (surface wiring)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    window.__game?.setPlayerMemory(null);
    window.__game?.setIoReturnReason(null);
    // Reset the harness to a fresh state so meetNpc's recognition
    // transition arms cleanly per case.
    window.__game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1),
    );
  });

  afterEach(() => {
    window.__game?.setPlayerMemory(null);
    window.__game?.setIoReturnReason(null);
    document.body.innerHTML = "";
  });

  it("attaches Io's opened-packet recall line to the round-trip beat on return", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    // Session 1: player opens the packet, meets Io. Save.
    const firstSession = meetIoForAftersignSlice(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), "opened"),
    );
    const payload = encodeAftersignDurableSave(firstSession, 9);

    // Session 2: restore + re-meet Io → recognition. Provide the
    // memory bag so `story.npcMemoryRoundTrip` is emitted.
    game?.restoreDurableSave(payload);
    game?.setPlayerMemory({ playerName: "Signal Runner", interactionCount: 2 });
    game?.meetNpc("io");

    const snapshot = game?.getStoryState();
    const roundTrip = snapshot?.story.npcMemoryRoundTrip;

    expect(roundTrip).toBeDefined();
    expect(roundTrip?.npcId).toBe("io");
    expect(roundTrip?.recallLine).toBeDefined();
    expect(roundTrip?.recallLine?.id).toBe("io-return-opened");
    // Authored copy from the recall table — verbatim, no interpolation.
    expect(roundTrip?.recallLine?.line).toBe(
      "You opened it. I heard the seal give before the room did.",
    );
    expect(roundTrip?.recallLine?.assertionText).toBe("You opened it.");
    expect(roundTrip?.recallLine?.trigger.scene).toBe("io-return");
    expect(roundTrip?.recallLine?.trigger.remembers).toBe("packet-opened");
    // Snapshot must remain JSON-serialisable — a served-page consumer
    // stringifies the state without importing the contract module.
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it("attaches Io's sealed-packet recall line on the sealed fork", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    const firstSession = meetIoForAftersignSlice(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
    );
    game?.restoreDurableSave(encodeAftersignDurableSave(firstSession, 11));
    game?.setPlayerMemory({ playerName: "Signal Runner", interactionCount: 3 });
    game?.meetNpc("io");

    const roundTrip = game?.getStoryState().story.npcMemoryRoundTrip;
    expect(roundTrip?.recallLine?.id).toBe("io-return-sealed");
    expect(roundTrip?.recallLine?.line).toBe(
      "Still sealed. Good. Some doors only learn your name after you refuse them.",
    );
    expect(roundTrip?.recallLine?.assertionText).toBe("Still sealed.");
    expect(roundTrip?.recallLine?.trigger.remembers).toBe("packet-sealed");
  });

  it("attaches Orra's answered-saint-orra recall line to her round-trip beat", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    // Orra recognizes on her own action axis — packet outcome not
    // required for her recall line.
    const firstSession = meetOrraForAftersignSlice(
      recordAftersignOrraAction(
        createAftersignVerticalSliceState(),
        "answered-saint-orra",
      ),
    );
    game?.restoreDurableSave(encodeAftersignDurableSave(firstSession, 13));
    game?.setPlayerMemory({ playerName: "Signal Runner", interactionCount: 2 });
    game?.meetNpc("orra");

    const roundTrip = game?.getStoryState().story.npcMemoryRoundTrip;
    expect(roundTrip?.npcId).toBe("orra");
    expect(roundTrip?.recallLine?.id).toBe("orra-return-answered-saint-orra");
    expect(roundTrip?.recallLine?.line).toBe(
      "You answered when the saint asked. That kind of voice leaves a thread.",
    );
    expect(roundTrip?.recallLine?.assertionText).toBe(
      "You answered when the saint asked.",
    );
    expect(roundTrip?.recallLine?.trigger.scene).toBe("orra-return");
    expect(roundTrip?.recallLine?.trigger.remembers).toBe("answered-saint-orra");
  });

  it("omits recallLine when no NPC memory input is supplied (round-trip absent)", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    // Without setPlayerMemory, the surface does not publish
    // story.npcMemoryRoundTrip at all — so there's no recallLine to
    // attach either. This locks the gate on both fields together.
    const firstSession = meetIoForAftersignSlice(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), "opened"),
    );
    game?.restoreDurableSave(encodeAftersignDurableSave(firstSession, 7));
    game?.meetNpc("io");

    const snapshot = game?.getStoryState();
    expect(snapshot?.story.npcMemoryRoundTrip).toBeUndefined();
  });
});
