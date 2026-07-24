import { describe, expect, it } from "vitest";

import {
  assertAftersignStoryStateInvariants,
  type AftersignGameHarnessSnapshot,
} from "./storyStateHarness";

function createHarnessSnapshot(
  override: Partial<AftersignGameHarnessSnapshot> = {},
): AftersignGameHarnessSnapshot {
  return {
    story: {
      currentBeatId: "io-recognizes-preserved-packet",
      visitedBeatIds: ["arrival", "packet-choice", "io-recognizes-preserved-packet"],
      routeAttention: "preserved-seal",
    },
    npcs: {
      io: {
        id: "io",
        displayName: "Io",
        memory: {
          referencedPlayerAction: "preserved-seal",
          lastReferencedBeatId: "io-recognizes-preserved-packet",
          line: "You kept the blue seal intact. I remember that.",
        },
      },
    },
    statePublishVersion: 7,
    ...override,
  };
}

describe("AFTERSIGN story/state harness contract", () => {
  it("accepts a window.__game snapshot whose story beat, route, NPC memory, and publish version agree", () => {
    const snapshot = createHarnessSnapshot();

    expect(() => assertAftersignStoryStateInvariants(snapshot)).not.toThrow();
  });

  it("rejects a published story beat that is not represented in visitedBeatIds", () => {
    const snapshot = createHarnessSnapshot({
      story: {
        currentBeatId: "io-recognizes-opened-packet",
        visitedBeatIds: ["arrival", "packet-choice"],
        routeAttention: "opened-seal",
      },
      npcs: {
        io: {
          id: "io",
          displayName: "Io",
          memory: {
            referencedPlayerAction: "opened-seal",
            lastReferencedBeatId: "io-recognizes-opened-packet",
            line: "You opened it before I arrived. I remember that.",
          },
        },
      },
      statePublishVersion: 8,
    });

    expect(() => assertAftersignStoryStateInvariants(snapshot)).toThrow(/currentBeatId.*visitedBeatIds/i);
  });

  it("rejects an Io memory action that does not match the committed route", () => {
    const snapshot = createHarnessSnapshot({
      npcs: {
        io: {
          id: "io",
          displayName: "Io",
          memory: {
            referencedPlayerAction: "opened-seal",
            lastReferencedBeatId: "io-recognizes-preserved-packet",
            line: "You kept the blue seal intact. I remember that.",
          },
        },
      },
      statePublishVersion: 9,
    });

    expect(() => assertAftersignStoryStateInvariants(snapshot)).toThrow(/Io.*referencedPlayerAction.*routeAttention/i);
  });

  it("rejects an Io memory line that does not name the committed player action", () => {
    const snapshot = createHarnessSnapshot({
      npcs: {
        io: {
          id: "io",
          displayName: "Io",
          memory: {
            referencedPlayerAction: "preserved-seal",
            lastReferencedBeatId: "io-recognizes-preserved-packet",
            line: "You opened it before I arrived. I remember that.",
          },
        },
      },
      statePublishVersion: 10,
    });

    expect(() => assertAftersignStoryStateInvariants(snapshot)).toThrow(/preserved-seal player action/i);
  });

  it("rejects snapshots that have not published state for the harness", () => {
    const snapshot = createHarnessSnapshot({ statePublishVersion: 0 });

    expect(() => assertAftersignStoryStateInvariants(snapshot)).toThrow(/positive statePublishVersion/i);
  });
});
