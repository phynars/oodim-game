import { describe, expect, it } from "vitest";

import type {
  FlagshipDeliveryOutcome,
  FlagshipSceneBeat,
} from "../../../../e2e-shared/flagshipStoryStateContract";
import {
  createAftersignVerticalSliceState,
  meetIoForAftersignSlice,
  recordAftersignPacketChoice,
} from "./verticalSliceRuntimeState";
import type { AftersignSceneId } from "./verticalSliceRuntimeState";
import {
  createAftersignWindowGameSurface,
  type AftersignStoryBeatId,
  type AftersignStoryStateSnapshot,
} from "./windowGameSurface";

const PLAYER = {
  playerId: "player-vitest-alignment",
  playerName: "Vitest Alignment Player",
  rememberedSessionIds: ["session-before-window"],
};

const STORY_BEAT_TO_FLAGSHIP_BEAT: Record<AftersignStoryBeatId, FlagshipSceneBeat> = {
  "packet-unresolved": "arrival",
  "packet-sealed": "packet-delivered",
  "packet-opened": "packet-delivered",
  "io-first-meeting": "packet-offered",
  "io-remembers-sealed-packet": "io-return-recognition",
  "io-remembers-opened-packet": "io-return-recognition",
};

// The vertical-slice snapshot uses its own scene vocabulary
// (`AftersignSceneId = "kiosk" | "io-return"`) while the flagship story-state
// contract pins `scene.id` to the literal `"io-night-post-kiosk"`. This map
// documents the projection so the alignment test can assert both sides:
// the vertical-slice literal we actually emit AND the flagship scene id it
// stands in for. When we later widen `AftersignSceneId` or rename the
// flagship scene, this record forces a compile error at the seam.
const SCENE_TO_FLAGSHIP_SCENE_ID: Record<AftersignSceneId, "io-night-post-kiosk"> = {
  kiosk: "io-night-post-kiosk",
  "io-return": "io-night-post-kiosk",
};

const PACKET_OUTCOME_TO_FLAGSHIP_DELIVERY: Record<
  NonNullable<AftersignStoryStateSnapshot["state"]["npcs"][number]["memory"]["packetOutcome"]>,
  FlagshipDeliveryOutcome
> = {
  sealed: "sealed",
  opened: "opened",
};

function getSnapshotForFlagshipAlignment(
  packetOutcome: "sealed" | "opened",
): AftersignStoryStateSnapshot {
  const firstSession = meetIoForAftersignSlice(
    recordAftersignPacketChoice(createAftersignVerticalSliceState(), packetOutcome),
  );
  const returningSession = meetIoForAftersignSlice(firstSession);

  return createAftersignWindowGameSurface(returningSession, PLAYER).getStoryState();
}

describe("AftersignWindowGameSurface flagship alignment", () => {
  it.each([
    ["sealed", "io-remembers-sealed-packet"],
    ["opened", "io-remembers-opened-packet"],
  ] as const)(
    "pins the vertical-slice snapshot fields that map to the FlagshipGameSurface for a %s packet",
    (packetOutcome, expectedStoryBeat) => {
      const snapshot = getSnapshotForFlagshipAlignment(packetOutcome);
      const io = snapshot.state.npcs[0];

      expect(snapshot.story.id).toBe("aftersign.verticalSlice");
      expect(snapshot.story.act).toBe("act-1");
      expect(snapshot.story.beat).toBe(expectedStoryBeat);
      expect(STORY_BEAT_TO_FLAGSHIP_BEAT[snapshot.story.beat]).toBe("io-return-recognition");
      expect(snapshot.story.completedBeats).toContain(expectedStoryBeat);

      // Two `meetIoForAftersignSlice` calls advance the vertical-slice scene
      // to `"io-return"`. That's the literal our snapshot carries; the
      // flagship-side scene id it maps to is asserted via
      // `SCENE_TO_FLAGSHIP_SCENE_ID` below.
      expect(snapshot.state.scene).toBe("io-return");
      expect(SCENE_TO_FLAGSHIP_SCENE_ID[snapshot.state.scene]).toBe("io-night-post-kiosk");
      expect(snapshot.state.player).toEqual({
        id: PLAYER.playerId,
        name: PLAYER.playerName,
      });

      expect(io.id).toBe("io");
      expect(io.name).toBe("Io");
      expect(io.disposition).toBe("recognizes-player");
      expect(io.rememberedSessionIds).toEqual(PLAYER.rememberedSessionIds);
      expect(io.memory.recognizesPlayer).toBe(true);
      expect(io.memory.packetOutcome).toBe(packetOutcome);
      expect(PACKET_OUTCOME_TO_FLAGSHIP_DELIVERY[io.memory.packetOutcome]).toBe(packetOutcome);
    },
  );

  it("keeps the vertical-slice subset honest about fields it does not claim yet", () => {
    const snapshot = getSnapshotForFlagshipAlignment("sealed");

    expect(snapshot).not.toHaveProperty("version");
    expect(snapshot).not.toHaveProperty("build");
    expect(snapshot).not.toHaveProperty("delivery");
    expect(snapshot).not.toHaveProperty("save");
    expect(snapshot.state.npcs[0]).not.toHaveProperty("lastLineMemoryRefs");
  });
});
