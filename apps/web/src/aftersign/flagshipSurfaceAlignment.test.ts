import { describe, expect, it } from "vitest";

import type {
  FlagshipDeliveryOutcome,
  FlagshipGameSurface,
} from "../../../../e2e-shared/flagshipStoryStateContract";
import {
  createAftersignVerticalSliceState,
  meetIoForAftersignSlice,
  recordAftersignPacketChoice,
} from "./verticalSliceRuntimeState";
import {
  createAftersignWindowGameSurface,
  type AftersignStoryStateSnapshot,
} from "./windowGameSurface";

// Fast-lane (vitest) twin of the browser-layer flagship-contract e2e specs.
//
// SCOPE (issue #798, option b): the vertical-slice snapshot
// `AftersignStoryStateSnapshot` is INTENTIONALLY a subset of the
// authoritative `FlagshipGameSurface` in
// e2e-shared/flagshipStoryStateContract.ts. It does not yet carry
// `version`, `build`, `delivery`, `save`, or `input` — growing the
// snapshot is explicitly out of scope here (see #798 "Scope"). What this
// test pins is the alignment the slice DOES claim today, so that drift in
// the covered region fails fast in vitest instead of only in Playwright:
//
//   1. Io npc identity — the slice's single npc is flagship's `npcs.io`
//      (id 'io'), enforced at both the type and runtime level.
//   2. packetOutcome → delivery outcome — every committed
//      AftersignPacketOutcome must remain a valid FlagshipDeliveryOutcome
//      ('sealed' | 'opened' ⊂ the flagship enum), enforced at compile time.
//   3. Snapshot purity — the snapshot must survive a JSON round-trip
//      byte-identical, mirroring assertSerializableFlagshipSurface's
//      "pure data, no functions/cycles/Dates" rule.
//   4. Beat/scene continuity across the slice's session arc (kiosk →
//      io-return), the invariant the deleted storyStateInvariants.test.ts
//      used to pin.
//
// If the snapshot grows toward the full FlagshipGameSurface, replace this
// subset test with an adapter + assertSerializableFlagshipSurface (issue
// #798, option a).

const PLAYER_OPTIONS = {
  playerId: "player-vitest-1",
  playerName: "Vitest Courier",
  rememberedSessionIds: ["session-1"],
};

function buildSnapshot(
  mutate?: (
    state: ReturnType<typeof createAftersignVerticalSliceState>,
  ) => ReturnType<typeof createAftersignVerticalSliceState>,
): AftersignStoryStateSnapshot {
  const base = createAftersignVerticalSliceState();
  const state = mutate ? mutate(base) : base;
  return createAftersignWindowGameSurface(state, PLAYER_OPTIONS).getStoryState();
}

describe("aftersign snapshot ↔ FlagshipGameSurface alignment (covered subset)", () => {
  it("exposes the flagship Io npc identity", () => {
    const snapshot = buildSnapshot();
    const io = snapshot.state.npcs[0];

    // Compile-time pin: the slice npc id must remain assignable to the
    // flagship npcs.io.id literal. If either side drifts, this line stops
    // compiling.
    const flagshipIoId: FlagshipGameSurface["npcs"]["io"]["id"] = io.id;

    expect(flagshipIoId).toBe("io");
    expect(snapshot.state.npcs).toHaveLength(1);
  });

  it("keeps every committed packetOutcome inside the flagship delivery-outcome enum", () => {
    for (const outcome of ["sealed", "opened"] as const) {
      const snapshot = buildSnapshot((state) =>
        recordAftersignPacketChoice(state, outcome),
      );
      const packetOutcome = snapshot.state.npcs[0].memory.packetOutcome;

      // Compile-time pin: AftersignPacketOutcome ⊂ FlagshipDeliveryOutcome.
      // 'unknown' is the flagship spelling of the slice's `null`.
      const deliveryOutcome: FlagshipDeliveryOutcome = packetOutcome ?? "unknown";

      expect(deliveryOutcome).toBe(outcome);
    }
  });

  it("maps an uncommitted packet to the flagship 'unknown' outcome", () => {
    const snapshot = buildSnapshot();
    const deliveryOutcome: FlagshipDeliveryOutcome =
      snapshot.state.npcs[0].memory.packetOutcome ?? "unknown";
    expect(deliveryOutcome).toBe("unknown");
  });

  it("is a pure data snapshot (JSON round-trip identical)", () => {
    const snapshot = buildSnapshot((state) =>
      meetIoForAftersignSlice(recordAftersignPacketChoice(state, "sealed")),
    );
    const cloned = JSON.parse(
      JSON.stringify(snapshot),
    ) as AftersignStoryStateSnapshot;
    expect(cloned).toEqual(snapshot);
  });

  it("pins the returning-session recognition arc (kiosk → io-return)", () => {
    // First session: choose sealed, meet Io. ioRecognizesPlayer stays false
    // because recognition requires a PRIOR meeting.
    const firstSession = meetIoForAftersignSlice(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
    );
    const firstSnapshot = createAftersignWindowGameSurface(
      firstSession,
      PLAYER_OPTIONS,
    ).getStoryState();

    expect(firstSnapshot.state.scene).toBe("io-return");
    expect(firstSnapshot.story.beat).toBe("io-first-meeting");
    expect(firstSnapshot.state.npcs[0].disposition).toBe("met-player");
    expect(firstSnapshot.state.npcs[0].memory.recognizesPlayer).toBe(false);

    // Returning session: Io has met the player before, so meeting again
    // flips recognition and the beat reflects the remembered outcome.
    const returningSession = meetIoForAftersignSlice(firstSession);
    const returningSnapshot = createAftersignWindowGameSurface(
      returningSession,
      PLAYER_OPTIONS,
    ).getStoryState();

    expect(returningSnapshot.story.beat).toBe("io-remembers-sealed-packet");
    expect(returningSnapshot.state.npcs[0].disposition).toBe("recognizes-player");
    expect(returningSnapshot.state.npcs[0].memory.recognizesPlayer).toBe(true);
    expect(returningSnapshot.story.completedBeats).toContain("packet-sealed");
    expect(returningSnapshot.story.completedBeats).toContain(
      "io-remembers-sealed-packet",
    );
  });
});
