import { describe, expect, it } from "vitest";

import type { FlagshipGameSurface } from "../../../../e2e-shared/flagshipStoryStateContract";
import {
  createAftersignWindowGameSurface,
  type AftersignStoryStateSnapshot,
} from "./windowGameSurface";
import {
  createAftersignVerticalSliceState,
  meetIoForAftersignSlice,
  recordAftersignPacketChoice,
} from "./verticalSliceRuntimeState";

// This vitest is the fast-lane twin of the browser-layer FlagshipGameSurface
// contract (see `e2e-shared/flagshipStoryStateContract.ts` and
// `docs/flagship/story-state-contract.md`). Its job is to fail loudly the
// moment the vertical-slice snapshot drifts from the subset of the flagship
// surface it CLAIMS to already cover.
//
// It intentionally covers only the subset the vertical-slice snapshot can
// actually derive from `AftersignStoryStateSnapshot` today (#798 option b):
//   - delivery.id (constant per spec) + delivery.outcome (from npc memory)
//   - npcs.io.id
//   - scene.beat (from `story.beat`, via `mapStoryBeat`)
//
// Fields the vertical-slice snapshot CANNOT yet honestly derive are called
// out below and deliberately excluded from the pinned subset:
//   - scene.id: FlagshipGameSurface fixes it to 'io-night-post-kiosk', but
//     the runtime enum `AftersignSceneId` is `'kiosk' | 'io-return'`. The
//     mapping is a separate impl issue; asserting a hardcoded flagship
//     literal here would be fabricated (see #798).
//   - scene.act: FlagshipGameSurface fixes it to 'act-1-seal', but the
//     snapshot reports `'act-1'`. Same gap.
// Growing the snapshot to close either gap is out of scope for #798 and
// should land in its own PR.

type ClaimedFlagshipSubset = {
  scene: Pick<FlagshipGameSurface["scene"], "beat">;
  delivery: Pick<FlagshipGameSurface["delivery"], "id" | "outcome">;
  npcs: {
    io: Pick<FlagshipGameSurface["npcs"]["io"], "id">;
  };
};

describe("AftersignWindowGameSurface flagship alignment", () => {
  it("pins the FlagshipGameSurface subset the vertical-slice snapshot claims today", () => {
    // Build the state through the real reducers so every field the test
    // reads comes from the runtime, not an ad-hoc cast.
    const initial = createAftersignVerticalSliceState();
    const afterChoice = recordAftersignPacketChoice(initial, "sealed");
    const afterFirstMeeting = meetIoForAftersignSlice(afterChoice);
    const afterReturn = meetIoForAftersignSlice(afterFirstMeeting);

    const surface = createAftersignWindowGameSurface(afterReturn, {
      playerId: "player-flagship-alignment",
      playerName: "Trace",
      rememberedSessionIds: ["session-before"],
    });

    const snapshot = surface.getStoryState();
    const aligned = toClaimedFlagshipSubset(snapshot);

    expect(aligned).toEqual({
      scene: {
        beat: "io-return-recognition",
      },
      delivery: {
        id: "blue-packet",
        outcome: "sealed",
      },
      npcs: {
        io: {
          id: "io",
        },
      },
    } satisfies ClaimedFlagshipSubset);
  });
});

function toClaimedFlagshipSubset(
  snapshot: AftersignStoryStateSnapshot,
): ClaimedFlagshipSubset {
  return {
    scene: {
      beat: mapStoryBeat(snapshot.story.beat),
    },
    delivery: {
      id: "blue-packet",
      outcome: snapshot.state.npcs[0].memory.packetOutcome ?? "unknown",
    },
    npcs: {
      io: {
        id: snapshot.state.npcs[0].id,
      },
    },
  };
}

function mapStoryBeat(
  beat: AftersignStoryStateSnapshot["story"]["beat"],
): FlagshipGameSurface["scene"]["beat"] {
  switch (beat) {
    case "packet-unresolved":
      return "arrival";
    case "packet-sealed":
    case "packet-opened":
      return "packet-choice";
    case "io-first-meeting":
      return "packet-offered";
    case "io-remembers-sealed-packet":
    case "io-remembers-opened-packet":
      return "io-return-recognition";
  }
}
