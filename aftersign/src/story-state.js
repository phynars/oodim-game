const DEFAULT_PLAYER_ID = "local-player";
const DEFAULT_NPC_ID = "io";
const DEFAULT_BEAT_ID = "io-first-memory";
const DEFAULT_EPISODE_ID = "pilot-kiosk";
const DEFAULT_SESSION_ID = "session-1";

export function createAftersignStoryState(overrides = {}) {
  const playerId = normalizeString(overrides.playerId, DEFAULT_PLAYER_ID);
  const npcId = normalizeString(overrides.npcId, DEFAULT_NPC_ID);
  const beatId = normalizeString(overrides.beatId, DEFAULT_BEAT_ID);
  const episodeId = normalizeString(overrides.episodeId, DEFAULT_EPISODE_ID);
  const sessionId = normalizeString(overrides.sessionId, DEFAULT_SESSION_ID);

  return {
    version: 1,
    player: {
      id: playerId,
      displayName: normalizeString(overrides.playerName, "Passenger"),
    },
    episode: {
      id: episodeId,
      scene: normalizeString(overrides.scene, "kiosk"),
      beat: beatId,
    },
    session: {
      id: sessionId,
      visitCount: normalizePositiveInteger(overrides.visitCount, 1),
    },
    npcs: {
      [npcId]: {
        id: npcId,
        displayName: normalizeString(overrides.npcName, "Io"),
        knownPlayerId: playerId,
        rememberedBeatIds: [beatId],
        lastLine: normalizeString(
          overrides.lastLine,
          "I remember you from the light by the kiosk."
        ),
      },
    },
    flags: {
      firstMemoryBeatSeen: true,
      durableSaveExpected: Boolean(overrides.durableSaveExpected),
    },
  };
}

export function serializeAftersignStoryState(state) {
  return JSON.stringify(validateAftersignStoryState(state));
}

export function parseAftersignStoryState(serialized) {
  if (typeof serialized !== "string" || serialized.trim().length === 0) {
    return createAftersignStoryState();
  }

  const parsed = JSON.parse(serialized);
  return validateAftersignStoryState(parsed);
}

export function installAftersignStateContract(target = globalThis, state = createAftersignStoryState()) {
  if (!target || typeof target !== "object") {
    throw new TypeError("installAftersignStateContract target must be an object");
  }

  const validated = validateAftersignStoryState(state);
  const existing = target.__game && typeof target.__game === "object" ? target.__game : {};

  target.__game = {
    ...existing,
    slug: "aftersign",
    storyState: validated,
    getStoryState() {
      return this.storyState;
    },
    setStoryState(nextState) {
      this.storyState = validateAftersignStoryState(nextState);
      return this.storyState;
    },
    remember(npcId = DEFAULT_NPC_ID, beatId = DEFAULT_BEAT_ID) {
      const next = cloneState(this.storyState);
      const npc = next.npcs[npcId];

      if (!npc) {
        throw new Error(`Unknown AFTERSIGN NPC: ${npcId}`);
      }

      if (!npc.rememberedBeatIds.includes(beatId)) {
        npc.rememberedBeatIds.push(beatId);
      }

      next.flags.firstMemoryBeatSeen = true;
      this.storyState = validateAftersignStoryState(next);
      return this.storyState;
    },
    exportStoryState() {
      return serializeAftersignStoryState(this.storyState);
    },
    importStoryState(serialized) {
      this.storyState = parseAftersignStoryState(serialized);
      return this.storyState;
    },
  };

  return target.__game;
}

export function validateAftersignStoryState(state) {
  if (!state || typeof state !== "object") {
    throw new TypeError("AFTERSIGN story state must be an object");
  }

  if (state.version !== 1) {
    throw new Error("AFTERSIGN story state version must be 1");
  }

  assertObject(state.player, "player");
  assertNonEmptyString(state.player.id, "player.id");
  assertNonEmptyString(state.player.displayName, "player.displayName");

  assertObject(state.episode, "episode");
  assertNonEmptyString(state.episode.id, "episode.id");
  assertNonEmptyString(state.episode.scene, "episode.scene");
  assertNonEmptyString(state.episode.beat, "episode.beat");

  assertObject(state.session, "session");
  assertNonEmptyString(state.session.id, "session.id");
  if (!Number.isInteger(state.session.visitCount) || state.session.visitCount < 1) {
    throw new Error("session.visitCount must be a positive integer");
  }

  assertObject(state.npcs, "npcs");
  const npcIds = Object.keys(state.npcs);
  if (npcIds.length === 0) {
    throw new Error("AFTERSIGN story state needs at least one NPC");
  }

  for (const npcId of npcIds) {
    const npc = state.npcs[npcId];
    assertObject(npc, `npcs.${npcId}`);
    assertNonEmptyString(npc.id, `npcs.${npcId}.id`);
    assertNonEmptyString(npc.displayName, `npcs.${npcId}.displayName`);
    assertNonEmptyString(npc.knownPlayerId, `npcs.${npcId}.knownPlayerId`);
    assertNonEmptyString(npc.lastLine, `npcs.${npcId}.lastLine`);

    if (npc.id !== npcId) {
      throw new Error(`NPC key ${npcId} must match npc.id`);
    }

    if (npc.knownPlayerId !== state.player.id) {
      throw new Error(`NPC ${npcId} must remember the active player`);
    }

    if (!Array.isArray(npc.rememberedBeatIds) || npc.rememberedBeatIds.length === 0) {
      throw new Error(`NPC ${npcId} needs at least one remembered beat`);
    }

    for (const beatId of npc.rememberedBeatIds) {
      assertNonEmptyString(beatId, `npcs.${npcId}.rememberedBeatIds[]`);
    }
  }

  assertObject(state.flags, "flags");
  if (state.flags.firstMemoryBeatSeen !== true) {
    throw new Error("flags.firstMemoryBeatSeen must be true for the vertical slice");
  }

  return cloneState(state);
}

function normalizeString(value, fallback) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function normalizePositiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}
