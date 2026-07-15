// AFTERSIGN — NPC memory round-trip contract seam.
//
// Pure-data harness for the flagship signature mechanic: an NPC must be able
// to reference a prior-session player choice after a reload. Keep this file
// free of rendering, storage, and network concerns so the contract can move to
// Durable Object / D1 authority without changing the story assertions.

export type AftersignNpcMemoryNpcId = "io";

export type AftersignNpcMemoryChoice = {
  id: string;
  summary: string;
};

export type AftersignNpcMemoryBeat = {
  id: string;
  playerId: string;
  choice: AftersignNpcMemoryChoice;
};

export type AftersignNpcMemoryRecall = {
  npcId: AftersignNpcMemoryNpcId;
  playerId: string;
  referencedBeatId: string;
  referencedChoiceId: string;
  line: string;
};

// Named to avoid colliding with `AftersignNpcMemorySnapshot` in
// packages/aftersign/src/storyStateHarness.ts (the earlier authority),
// which describes an entirely different shape (referencedPlayerAction /
// lastReferencedBeatId / line).
export type AftersignNpcMemoryRoundTripSnapshot = {
  version: 1;
  beats: AftersignNpcMemoryBeat[];
};

export type AftersignNpcMemoryRoundTrip = {
  remember: (beat: AftersignNpcMemoryBeat) => void;
  recallFor: (npcId: AftersignNpcMemoryNpcId, playerId: string) => AftersignNpcMemoryRecall | null;
  save: () => AftersignNpcMemoryRoundTripSnapshot;
  reload: () => AftersignNpcMemoryRoundTrip;
};

export function createNpcMemoryRoundTrip(
  snapshot: AftersignNpcMemoryRoundTripSnapshot = { version: 1, beats: [] },
): AftersignNpcMemoryRoundTrip {
  const beats = snapshot.beats.map(copyBeat);

  return {
    remember(beat) {
      beats.push(copyBeat(beat));
    },
    recallFor(npcId, playerId) {
      const beat = [...beats].reverse().find((candidate) => candidate.playerId === playerId);

      if (!beat) {
        return null;
      }

      return {
        npcId,
        playerId,
        referencedBeatId: beat.id,
        referencedChoiceId: beat.choice.id,
        line: buildIoRecallLine(beat.choice),
      };
    },
    save() {
      return {
        version: 1,
        beats: beats.map(copyBeat),
      };
    },
    reload() {
      return createNpcMemoryRoundTrip({
        version: 1,
        beats: beats.map(copyBeat),
      });
    },
  };
}

function copyBeat(beat: AftersignNpcMemoryBeat): AftersignNpcMemoryBeat {
  return {
    id: beat.id,
    playerId: beat.playerId,
    choice: {
      id: beat.choice.id,
      summary: beat.choice.summary,
    },
  };
}

function buildIoRecallLine(choice: AftersignNpcMemoryChoice): string {
  return `Io remembers that you ${choice.summary}. The sealed packet changed how the room listened.`;
}
