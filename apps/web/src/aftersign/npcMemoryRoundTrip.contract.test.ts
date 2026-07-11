import { describe, expect, it } from "vitest";

type GameDebugSurface = {
  npcMemory?: {
    playerId?: string;
    npcId?: string;
    priorSessionFacts?: string[];
    lastLine?: string;
    save?: () => unknown;
    load?: (snapshot: unknown) => unknown;
  };
};

function assertNpcMemoryRoundTrip(game: GameDebugSurface): void {
  const memory = game.npcMemory;

  expect(memory, "window.__game.npcMemory must expose the flagship memory harness surface").toBeDefined();
  expect(memory?.playerId, "memory must be keyed to a durable player identity").toBeTruthy();
  expect(memory?.npcId, "memory must identify the remembering NPC").toBeTruthy();
  expect(memory?.priorSessionFacts, "memory must expose facts recalled from a previous session").toEqual(
    expect.arrayContaining(["player-returned-after-prior-session"]),
  );
  expect(memory?.lastLine, "NPC dialogue must visibly reference the prior-session fact").toContain(
    "player-returned-after-prior-session",
  );
  expect(memory?.save, "memory harness must expose a durable save operation").toEqual(expect.any(Function));
  expect(memory?.load, "memory harness must expose a durable load operation").toEqual(expect.any(Function));

  const snapshot = memory?.save?.();
  const loaded = memory?.load?.(snapshot);

  expect(loaded, "save/load must preserve the recalled fact").toMatchObject({
    priorSessionFacts: expect.arrayContaining(["player-returned-after-prior-session"]),
  });
}

describe("AFTERSIGN NPC memory harness contract", () => {
  it("fails until window.__game exposes an NPC memory round-trip with visible recall", () => {
    const game: GameDebugSurface = {};

    assertNpcMemoryRoundTrip(game);
  });
});
