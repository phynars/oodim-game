// Vitest-level twin of the FlagshipGameSurface contract for aftersign.
//
// Restores the fast-lane coverage lost when PR #796's fix-up deleted
// `storyStateInvariants.test.ts` (it imported the removed
// `createAftersignWindowGame`). See issue #798.
//
// SCOPE (issue #798, option b): the vertical-slice snapshot
// (`AftersignStoryStateSnapshot`) is INTENTIONALLY a subset of the
// authoritative `FlagshipGameSurface` defined in
// `e2e-shared/flagshipStoryStateContract.ts` (which additionally requires
// `version`, `build.slug`, `scene.act/beat`, `delivery.id`,
// `npcs.io.memories`, `save.slot`, ...). This test does NOT claim the
// snapshot satisfies the full contract — that's tracked separately if
// the snapshot ever grows. What it DOES pin is every FlagshipGameSurface
// expectation the vertical slice covers today:
//
//   1. The snapshot is pure serializable data (harness reads are data).
//   2. Io npc identity aligns with `npcs.io.id` in the flagship contract.
//   3. Every `AftersignPacketOutcome` is a valid `FlagshipDeliveryOutcome`
//      and maps to the expected delivery outcome.
//   4. Every `AftersignStoryBeatId` maps to the expected `FlagshipSceneBeat`
//      (the vertical-slice beats live inside the flagship beat space).
//   5. Both aftersign scenes play inside the single flagship scene
//      `io-night-post-kiosk` — the slice never invents a scene the
//      flagship contract doesn't know about.
//
// If the flagship contract renames an enum value or the snapshot drifts,
// the `satisfies` checks below fail at typecheck time and the runtime
// asserts fail in vitest — the fast lane catches it before the browser
// e2e lane does.
//
// Sibling: `windowGameSurface.contract.test.ts` covers the durable-restore
// round-trip snapshot-equality path. This file is deliberately different
// — it pins the CROSS-PACKAGE flagship↔slice type alignment that a plain
// snapshot equality cannot catch.
//
// Imports are routed through the `./verticalSliceState` barrel (the stable
// public surface of the slice) rather than the concern-focused sibling
// modules (`./verticalSliceRuntimeState`, `./windowGameSurface`) so a
// future re-partitioning of those modules doesn't break this test again.

import { describe, expect, it } from "vitest";

import type {
  FlagshipDeliveryOutcome,
  FlagshipGameSurface,
  FlagshipSceneBeat,
} from "../../../../e2e-shared/flagshipStoryStateContract";
import {
  createAftersignVerticalSliceState,
  createAftersignWindowGameSurface,
  meetIoForAftersignSlice,
  recordAftersignPacketChoice,
  type AftersignPacketOutcome,
  type AftersignSceneId,
  type AftersignStoryBeatId,
  type AftersignStoryStateSnapshot,
} from "./verticalSliceState";

const SURFACE_OPTIONS = {
  playerId: "player-test-1",
  playerName: "Tester",
  rememberedSessionIds: ["session-1"],
};

function buildSnapshot(
  mutate?: (
    state: ReturnType<typeof createAftersignVerticalSliceState>,
  ) => ReturnType<typeof createAftersignVerticalSliceState>,
): AftersignStoryStateSnapshot {
  const base = createAftersignVerticalSliceState();
  const state = mutate ? mutate(base) : base;
  return createAftersignWindowGameSurface(state, SURFACE_OPTIONS).getStoryState();
}

// ---------------------------------------------------------------------------
// Type-level alignment pins. These lines fail `tsc` if either side of the
// contract drifts — no runtime needed. They intentionally reference the
// flagship types so a rename in e2e-shared/flagshipStoryStateContract.ts
// breaks THIS file, not just the browser e2e lane.
// ---------------------------------------------------------------------------

// (3) packetOutcome → delivery.outcome: every aftersign outcome must be a
// valid flagship delivery outcome. (The reverse is NOT required — the
// slice covers a subset: no 'withheld' / 'returned' / 'unknown' yet.)
const OUTCOME_ALIGNMENT: Record<AftersignPacketOutcome, FlagshipDeliveryOutcome> = {
  sealed: "sealed",
  opened: "opened",
};

// (4) Every vertical-slice story beat maps into the flagship beat space.
//
// The Orra slice beats piggy-back on the flagship's existing recognition
// beats — Orra doesn't (yet) have her own dedicated FlagshipSceneBeat.
// `orra-first-meeting` reuses `packet-offered` (first NPC encounter on
// the return leg) and `orra-remembers-answered-saint-orra` reuses
// `io-return-recognition` (the recognition-envelope shape is identical:
// NPC remembers a prior player action). When Orra gets her own beats in
// the flagship contract, these two mappings become 1:1 and the reuse
// note goes away.
const BEAT_ALIGNMENT: Record<AftersignStoryBeatId, FlagshipSceneBeat> = {
  "packet-unresolved": "arrival",
  "packet-sealed": "packet-choice",
  "packet-opened": "packet-choice",
  "io-first-meeting": "packet-offered",
  "io-remembers-sealed-packet": "io-return-recognition",
  "io-remembers-opened-packet": "io-return-recognition",
  "orra-first-meeting": "packet-offered",
  "orra-remembers-answered-saint-orra": "io-return-recognition",
  // M-CONTINUE-E1 beats map 1:1 into the flagship beat space now that
  // the shared contract union carries them (see
  // e2e-shared/flagshipStoryStateContract.ts).
  "return-tone-choice": "return-tone-choice",
  "io-next-job": "io-next-job",
};

// (5) Every aftersign scene plays inside the single flagship scene
// `io-night-post-kiosk`. The Orra return leg is a distinct slice-level
// scene id but stays inside the same flagship scene bucket — the slice
// never invents a flagship scene the contract doesn't know about.
const SCENE_ALIGNMENT: Record<AftersignSceneId, FlagshipGameSurface["scene"]["id"]> = {
  kiosk: "io-night-post-kiosk",
  "io-return": "io-night-post-kiosk",
  "orra-return": "io-night-post-kiosk",
};

// (2) Io identity: the snapshot's npc id literal must be assignable to the
// flagship contract's npcs.io.id literal.
type AftersignIoId = AftersignStoryStateSnapshot["state"]["npcs"][number]["id"];
const IO_ID_ALIGNMENT: FlagshipGameSurface["npcs"]["io"]["id"] =
  "io" satisfies AftersignIoId;

describe("aftersign snapshot ↔ FlagshipGameSurface alignment (vitest twin)", () => {
  it("is a pure serializable data snapshot (no functions, cycles, or Dates)", () => {
    const snapshot = buildSnapshot((state) =>
      meetIoForAftersignSlice(recordAftersignPacketChoice(state, "sealed")),
    );
    const roundTripped = JSON.parse(
      JSON.stringify(snapshot),
    ) as AftersignStoryStateSnapshot;
    expect(roundTripped).toEqual(snapshot);
  });

  it("pins Io npc identity to the flagship contract's npcs.io.id", () => {
    const snapshot = buildSnapshot();
    const io = snapshot.state.npcs[0];
    expect(io.id).toBe(IO_ID_ALIGNMENT);
    expect(io.name).toBe("Io");
  });

  it("maps every packetOutcome the slice produces to its flagship delivery outcome", () => {
    for (const outcome of ["sealed", "opened"] as const) {
      const snapshot = buildSnapshot((state) =>
        recordAftersignPacketChoice(state, outcome),
      );
      const packetOutcome = snapshot.state.npcs[0].memory.packetOutcome;
      expect(packetOutcome).toBe(outcome);
      expect(packetOutcome).not.toBeNull();
      expect(OUTCOME_ALIGNMENT[packetOutcome]).toBe(outcome);
    }
  });

  it("maps every reachable story beat to the expected flagship beat", () => {
    const reachableSnapshots: Array<{
      snapshot: AftersignStoryStateSnapshot;
      expectedBeat: FlagshipSceneBeat;
      expectedCompletedBeats: FlagshipSceneBeat[];
    }> = [
      {
        snapshot: buildSnapshot(),
        expectedBeat: "arrival",
        expectedCompletedBeats: [],
      },
      {
        snapshot: buildSnapshot((state) => recordAftersignPacketChoice(state, "sealed")),
        expectedBeat: "packet-choice",
        expectedCompletedBeats: ["packet-choice"],
      },
      {
        snapshot: buildSnapshot((state) => recordAftersignPacketChoice(state, "opened")),
        expectedBeat: "packet-choice",
        expectedCompletedBeats: ["packet-choice"],
      },
      {
        snapshot: buildSnapshot((state) => meetIoForAftersignSlice(state)),
        expectedBeat: "packet-offered",
        expectedCompletedBeats: ["packet-offered"],
      },
      {
        snapshot: buildSnapshot((state) =>
          meetIoForAftersignSlice(
            meetIoForAftersignSlice(recordAftersignPacketChoice(state, "sealed")),
          ),
        ),
        expectedBeat: "io-return-recognition",
        expectedCompletedBeats: ["packet-choice", "packet-offered", "io-return-recognition"],
      },
      {
        snapshot: buildSnapshot((state) =>
          meetIoForAftersignSlice(
            meetIoForAftersignSlice(recordAftersignPacketChoice(state, "opened")),
          ),
        ),
        expectedBeat: "io-return-recognition",
        expectedCompletedBeats: ["packet-choice", "packet-offered", "io-return-recognition"],
      },
    ];

    for (const { snapshot, expectedBeat, expectedCompletedBeats } of reachableSnapshots) {
      expect(BEAT_ALIGNMENT[snapshot.story.beat]).toBe(expectedBeat);
      expect(snapshot.story.completedBeats.map((beat) => BEAT_ALIGNMENT[beat])).toEqual(
        expectedCompletedBeats,
      );
    }
  });

  it("keeps every scene the slice reaches inside the flagship scene", () => {
    const kioskSnapshot = buildSnapshot();
    const returnSnapshot = buildSnapshot((state) => meetIoForAftersignSlice(state));

    expect(SCENE_ALIGNMENT[kioskSnapshot.state.scene]).toBe("io-night-post-kiosk");
    expect(SCENE_ALIGNMENT[returnSnapshot.state.scene]).toBe("io-night-post-kiosk");
  });
});
