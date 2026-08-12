import { expect, test, type Page } from "@playwright/test";

type StoryStateSnapshot = {
  story?: {
    beatId?: unknown;
    currentBeatId?: unknown;
    actId?: unknown;
    packet?: {
      id?: unknown;
      sealed?: unknown;
      delivered?: unknown;
      state?: unknown;
    };
  };
  packet?: {
    id?: unknown;
    sealed?: unknown;
    delivered?: unknown;
    state?: unknown;
  };
  npcMemory?: {
    io?: {
      facts?: unknown;
      references?: unknown;
      rememberedPlayerActions?: unknown;
    };
  };
  memory?: {
    io?: {
      facts?: unknown;
      references?: unknown;
      rememberedPlayerActions?: unknown;
    };
  };
};

type StoryStateSavePacket = {
  slotId?: unknown;
  revision?: unknown;
  snapshot?: StoryStateSnapshot;
};

type StoryStateGame = {
  getSnapshot?: () => StoryStateSnapshot | Promise<StoryStateSnapshot>;
  save?: () => StoryStateSavePacket | Promise<StoryStateSavePacket>;
  load?: (packet: StoryStateSavePacket) => StoryStateSnapshot | Promise<StoryStateSnapshot>;
  input?: {
    waitForStoryIdle?: () => Promise<void>;
  };
};

type NormalizedStoryState = {
  beatId: string;
  packetId: string;
  packetSealed: boolean;
  ioMemoryReferences: string[];
};

const hasGameContract = (value: unknown): value is Required<Pick<StoryStateGame, "getSnapshot" | "save" | "load">> => {
  if (typeof value !== "object" || value === null) return false;
  const probe = value as StoryStateGame;
  return (
    typeof probe.getSnapshot === "function" &&
    typeof probe.save === "function" &&
    typeof probe.load === "function"
  );
};

async function waitForStoryStateGame(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const game = (window as typeof window & { __game?: unknown }).__game;
    if (typeof game !== "object" || game === null) return false;
    const probe = game as StoryStateGame;
    return (
      typeof probe.getSnapshot === "function" &&
      typeof probe.save === "function" &&
      typeof probe.load === "function"
    );
  });
}

async function waitForStoryIdle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const game = (window as typeof window & { __game?: StoryStateGame }).__game;
    await game?.input?.waitForStoryIdle?.();
  });
}

async function getSnapshot(page: Page): Promise<StoryStateSnapshot> {
  await waitForStoryStateGame(page);
  await waitForStoryIdle(page);
  return page.evaluate(async () => {
    const game = (window as typeof window & { __game?: unknown }).__game;
    if (!hasGameContract(game)) {
      throw new Error("window.__game story/state contract is missing getSnapshot/save/load");
    }
    return game.getSnapshot();
  });
}

async function saveStoryState(page: Page): Promise<StoryStateSavePacket> {
  await waitForStoryStateGame(page);
  await waitForStoryIdle(page);
  return page.evaluate(async () => {
    const game = (window as typeof window & { __game?: unknown }).__game;
    if (!hasGameContract(game)) {
      throw new Error("window.__game story/state contract is missing getSnapshot/save/load");
    }
    return game.save();
  });
}

async function loadStoryState(page: Page, packet: StoryStateSavePacket): Promise<StoryStateSnapshot> {
  await waitForStoryStateGame(page);
  return page.evaluate(async (savedPacket) => {
    const game = (window as typeof window & { __game?: unknown }).__game;
    if (!hasGameContract(game)) {
      throw new Error("window.__game story/state contract is missing getSnapshot/save/load");
    }
    return game.load(savedPacket);
  }, packet);
}

function normalizeStoryState(snapshot: StoryStateSnapshot): NormalizedStoryState {
  const packet = snapshot.story?.packet ?? snapshot.packet;
  const ioMemory = snapshot.npcMemory?.io ?? snapshot.memory?.io;
  const ioMemoryReferences = normalizeReferences(
    ioMemory?.references ?? ioMemory?.rememberedPlayerActions ?? ioMemory?.facts,
  );

  return {
    beatId: readRequiredString(snapshot.story?.beatId ?? snapshot.story?.currentBeatId, "story beat id"),
    packetId: readRequiredString(packet?.id, "packet id"),
    packetSealed: readPacketSealed(packet),
    ioMemoryReferences,
  };
}

function readRequiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Expected ${label} to be a non-empty string`);
  }
  return value;
}

function readPacketSealed(packet: StoryStateSnapshot["packet"]): boolean {
  if (!packet) throw new Error("Expected story packet to be present");
  if (packet.sealed === true) return true;
  if (packet.delivered === false) return false;
  if (packet.state === "sealed" || packet.state === "ready") return true;
  throw new Error("Expected story packet to expose sealed-before-delivery state");
}

function normalizeReferences(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error("Expected Io memory references to be an array");
  }

  return value.map((entry, index) => {
    if (typeof entry === "string" && entry.length > 0) return entry;
    if (typeof entry === "object" && entry !== null) {
      const id = (entry as { id?: unknown; refId?: unknown; actionId?: unknown }).id ??
        (entry as { id?: unknown; refId?: unknown; actionId?: unknown }).refId ??
        (entry as { id?: unknown; refId?: unknown; actionId?: unknown }).actionId;
      if (typeof id === "string" && id.length > 0) return id;
    }
    throw new Error(`Expected Io memory reference ${index} to expose a stable id`);
  });
}

test.describe("Aftersign story/state save-load contract", () => {
  test("persists the current story beat, sealed packet, and Io memory references across a served-page reload", async ({ page }) => {
    await page.goto("./");

    const before = normalizeStoryState(await getSnapshot(page));
    expect(before.packetSealed).toBe(true);
    expect(before.ioMemoryReferences.length).toBeGreaterThan(0);

    const saved = await saveStoryState(page);
    expect(saved).toMatchObject({ snapshot: expect.any(Object) });

    await page.reload();
    const restored = normalizeStoryState(await loadStoryState(page, saved));

    expect(restored).toEqual(before);
  });
});
