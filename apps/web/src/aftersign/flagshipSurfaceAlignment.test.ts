// Fast-lane vitest twin of the browser-level FlagshipGameSurface contract
// (e2e-shared/flagshipStoryStateContract.ts).  The vertical-slice snapshot
// published by createAftersignWindowGameSurface is INTENTIONALLY a subset of
// FlagshipGameSurface — this test pins the alignment it DOES claim today:
//
//   1. story.id / story.act / story.beat / completedBeats are the exact
//      literals the runtime produces (compile-time pins).
//   2. state.npcs[0].id is the compile-time "io" literal that the flagship
//      contract's npcs.io key depends on.
//   3. state.npcs[0].memory.packetOutcome is a subset of
//      FlagshipDeliveryOutcome — asserted via a `satisfies` clause so a
//      drift in AftersignPacketOutcome fails typecheck, not runtime.
//   4. The snapshot round-trips through JSON byte-identically (no functions,
//      no cycles, no Dates) — same purity rule the browser-level
//      assertSerializableFlagshipSurface enforces.
//   5. The returning-session recognition arc (meetIoForAftersignSlice twice)
//      produces disposition === "recognizes-player" and the
//      "io-remembers-*-packet" beat — the arc the flagship's
//      IO_RETURN_MEMORY_ID mapping ultimately serves.
//
// Ref: issue #798 (option b — document the subset, pin what's real).

import { describe, expect, it } from "vitest";

import {
  createAftersignVerticalSliceState,
  meetIoForAftersignSlice,
  recordAftersignPacketChoice,
  type AftersignPacketOutcome,
} from "./verticalSliceState";
import {
  createAftersignWindowGameSurface,
  getAftersignStoryState,
} from "./windowGameSurface";

// Mirror of the FlagshipDeliveryOutcome union defined in
// e2e-shared/flagshipStoryStateContract.ts.  Kept as a local mirror
// because `apps/web/src/` is not in that file's tsconfig include path
// — the compile-time subset check below still fails typecheck if
// AftersignPacketOutcome grows a value not listed here.  If the
// authoritative union in e2e-shared changes, update this mirror in
// the same PR.
type FlagshipDeliveryOutcomeMirror =
  | "unknown"
  | "sealed"
  | "opened"
  | "withheld"
  | "returned";

const DEFAULT_OPTIONS = {
  playerId: "player-vertical-slice",
  playerName: "Signal Runner",
} as const;

describe("Aftersign flagship surface alignment", () => {
  it("publishes the story/state snapshot the fast-lane e2e twin depends on", () => {
    const state = recordAftersignPacketChoice(
      createAftersignVerticalSliceState(),
      "sealed",
    );

    const surface = createAftersignWindowGameSurface(state, DEFAULT_OPTIONS);
    const snapshot = surface.getStoryState();

    // Story block — exact literals the flagship contract's scene/act/beat
    // fields consume once the vertical slice grows into the full surface.
    expect(snapshot.story.id).toBe("aftersign.verticalSlice");
    expect(snapshot.story.act).toBe("act-1");
    expect(snapshot.story.beat).toBe("packet-sealed");
    expect(snapshot.story.completedBeats).toEqual(["packet-sealed"]);

    // State block — scene id + player identity survive verbatim.
    expect(snapshot.state.scene).toBe("kiosk");
    expect(snapshot.state.player).toEqual({
      id: DEFAULT_OPTIONS.playerId,
      name: DEFAULT_OPTIONS.playerName,
    });

    // npcs is a 1-tuple array in the vertical slice (not the object-keyed
    // `{ io: ... }` map the flagship uses).  Pin the length + the compile-
    // time "io" literal so a rename or an extra NPC entry breaks the test.
    expect(snapshot.state.npcs).toHaveLength(1);
    const io = snapshot.state.npcs[0];
    const ioId: "io" = io.id; // compile-time literal pin
    expect(ioId).toBe("io");
    expect(io.name).toBe("Io");
    expect(io.disposition).toBe("waiting");
    expect(io.memory).toEqual({
      recognizesPlayer: false,
      packetOutcome: "sealed",
    });
  });

  it("pins packetOutcome as a subset of the flagship's FlagshipDeliveryOutcome", () => {
    // Compile-time subset proof: every AftersignPacketOutcome must be
    // assignable to FlagshipDeliveryOutcome.  The assignment fails
    // typecheck if the aftersign enum grows a value the flagship
    // contract does not accept — exactly the drift we want CI to catch.
    const _subsetProof = (
      value: AftersignPacketOutcome,
    ): FlagshipDeliveryOutcomeMirror => value;
    void _subsetProof;

    // Runtime pin: the outcomes the vertical slice actually emits are
    // both members of FlagshipDeliveryOutcome.
    const validFlagshipOutcomes: readonly FlagshipDeliveryOutcomeMirror[] = [
      "unknown",
      "sealed",
      "opened",
      "withheld",
      "returned",
    ];
    for (const outcome of ["sealed", "opened"] as const) {
      const state = recordAftersignPacketChoice(
        createAftersignVerticalSliceState(),
        outcome,
      );
      const snapshot = getAftersignStoryState(state, DEFAULT_OPTIONS);
      const runtimeOutcome = snapshot.state.npcs[0].memory.packetOutcome;
      expect(runtimeOutcome).toBe(outcome);
      expect(validFlagshipOutcomes).toContain(runtimeOutcome);
    }
  });

  it("round-trips byte-identically through JSON (pure data snapshot)", () => {
    // Mirrors assertSerializableFlagshipSurface: no functions, no cycles,
    // no Dates.  Harness reads must be plain data.
    const state = meetIoForAftersignSlice(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), "opened"),
    );
    const snapshot = getAftersignStoryState(state, {
      ...DEFAULT_OPTIONS,
      rememberedSessionIds: ["session-a", "session-b"],
    });

    const cloned = JSON.parse(JSON.stringify(snapshot));
    expect(cloned).toEqual(snapshot);

    // A stray function on the snapshot would silently disappear through
    // JSON.stringify — assert every value on both trees is JSON-safe by
    // comparing the deep-cloned tree structurally.
    expect(JSON.stringify(cloned)).toBe(JSON.stringify(snapshot));
  });

  it("advances the returning-session recognition arc the flagship's memory mapping depends on", () => {
    // First meeting: player is met but not yet recognized.
    const firstMeeting = meetIoForAftersignSlice(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
    );
    const firstSnapshot = getAftersignStoryState(firstMeeting, DEFAULT_OPTIONS);
    expect(firstSnapshot.state.npcs[0].disposition).toBe("met-player");
    expect(firstSnapshot.state.npcs[0].memory.recognizesPlayer).toBe(false);
    expect(firstSnapshot.story.beat).toBe("io-first-meeting");

    // Second meeting on the same durable state → recognition flips on.
    // (meetIoForAftersignSlice sets recognizesPlayer from the pre-existing
    //  ioHasMetPlayer flag — the vertical slice's stand-in for the
    //  flagship contract's IO_RETURN_MEMORY_ID['sealed'] mapping.)
    const returningSession = meetIoForAftersignSlice(firstMeeting);
    const returningSnapshot = getAftersignStoryState(
      returningSession,
      DEFAULT_OPTIONS,
    );
    expect(returningSnapshot.state.npcs[0].disposition).toBe(
      "recognizes-player",
    );
    expect(returningSnapshot.state.npcs[0].memory.recognizesPlayer).toBe(true);
    expect(returningSnapshot.story.beat).toBe("io-remembers-sealed-packet");
    expect(returningSnapshot.story.completedBeats).toEqual([
      "packet-sealed",
      "io-first-meeting",
      "io-remembers-sealed-packet",
    ]);
  });
});
