// AFTERSIGN slice-1 story-state contract.
//
// Implements the FlagshipGameSurface shape defined in
// docs/flagship/story-state-contract.md so the WebGL-headless harness has a
// stable, plain-serializable window.__game to read.
//
// The "authoritative save" is an injectable server store — a plain object that
// outlives a forceReload({clearLocalState:true}) call.  In slice-1 we default
// to a module-level singleton so a single page context can prove the
// server-vs-local-fallback distinction WITHOUT the DO/D1 backend being live
// yet.  Once the real server lands, callers pass a fetch-backed store that
// implements the same {load, save} shape and the surface is unchanged.

const SLUG = "aftersign";
const DELIVERY_ID = "blue-packet";
const SCENE_ID = "io-night-post-kiosk";
const ACT_ID = "act-1-seal";
const DEFAULT_PLAYER_ID = "local-slice-player";
const SESSION_ID_PREFIX = "session-";
const SLOT = "default";

const BEATS = Object.freeze([
  "arrival",
  "packet-offered",
  "packet-choice",
  "packet-delivered",
  "io-return-recognition",
]);

const CHOICES = Object.freeze([
  "keep-sealed",
  "open-packet",
  "deliver-packet",
  "return-to-io",
]);

const OUTCOMES = Object.freeze([
  "unknown",
  "sealed",
  "opened",
  "withheld",
  "returned",
]);

const TRUST_POSTURES = Object.freeze([
  "untested",
  "trusted-seal",
  "useful-breach",
]);

const BREAK_MODES = Object.freeze([
  "drop-memory",
  "wrong-io-line",
  "local-only-save",
]);

const SEALED_MEMORY_ID = "io-remembers-blue-packet-sealed";
const OPENED_MEMORY_ID = "io-remembers-blue-packet-opened";

const SEALED_LINE = "You came back. The blue seal, unbroken — I remember that.";
const OPENED_LINE = "The seal did not hold. I remember what you chose.";
const ARRIVAL_LINE =
  "You made it. Touch the kiosk; leave one clean mark and I will remember which route you chose.";
const OFFERED_LINE =
  "Here — a blue packet. Keep it sealed, or open it and read it before the drop. Either way, I will know.";
const DELIVERED_SEALED_LINE = "Sealed. The kiosk swallowed it whole; I saw the seal.";
const DELIVERED_OPENED_LINE = "You read it before the drop. That, too, I saw.";

// A module-level default server store so slice-1 has a working "server" even
// when no real backend is wired.  The store persists across a soft reload
// (forceReload) but is process-local — a real page navigation blows it away,
// which is the correct semantics for "not yet the durable DO/D1 backend".
const defaultServerStore = createInMemoryServerStore();

/** @typedef {"arrival"|"packet-offered"|"packet-choice"|"packet-delivered"|"io-return-recognition"} Beat */
/** @typedef {"unknown"|"sealed"|"opened"|"withheld"|"returned"} DeliveryOutcome */
/** @typedef {"untested"|"trusted-seal"|"useful-breach"} TrustPosture */
/** @typedef {"keep-sealed"|"open-packet"|"deliver-packet"|"return-to-io"} ChoiceId */
/** @typedef {"drop-memory"|"wrong-io-line"|"local-only-save"|null} BreakMode */

/**
 * Create the FlagshipGameSurface state machine.
 *
 * @param {object} [options]
 * @param {string} [options.playerId]
 * @param {"test"|"dev"|"prod"} [options.mode]
 * @param {BreakMode} [options.breakMode]  Red-polarity mode; null = green.
 * @param {ServerStore} [options.serverStore]  Injectable authoritative store.
 * @param {LocalStore} [options.localStore]  Injectable localStorage-like cache.
 * @param {() => number} [options.now]  Injectable clock for tests.
 * @param {(beat: Beat) => void} [options.onBeatChange]  Optional listener for UI.
 */
export function createFlagshipGameSurface(options = {}) {
  const mode = options.mode ?? "test";
  const breakMode = normalizeBreakMode(options.breakMode);
  const serverStore = options.serverStore ?? defaultServerStore;
  const localStore = options.localStore ?? createMemoryLocalStore();
  const now = options.now ?? (() => Date.now());
  const onBeatChange = options.onBeatChange ?? (() => {});
  const playerId = normalizeString(options.playerId, DEFAULT_PLAYER_ID);

  let sessionCounter = 1;
  let sessionId = `${SESSION_ID_PREFIX}${sessionCounter}`;

  // Choice intent — captured by `choose()` before `deliver-packet` resolves.
  /** @type {"keep-sealed"|"open-packet"|null} */
  let sealIntent = null;
  let idleTicket = 0;
  const idleWaiters = new Set();

  const state = {
    version: 1,
    build: { slug: SLUG, mode },
    scene: {
      id: SCENE_ID,
      act: ACT_ID,
      beat: "arrival",
      ready: false,
    },
    player: {
      id: playerId,
      name: null,
      flags: {
        io_intro_seen: false,
        io_route_listened: false,
        returned_after_first_session: false,
        answer_tone: "unset",
      },
    },
    delivery: {
      id: DELIVERY_ID,
      outcome: "unknown",
    },
    npcs: {
      io: {
        id: "io",
        displayName: "Io Vale",
        present: true,
        trustPosture: "untested",
        memories: [],
        lastLine: ARRIVAL_LINE,
        lastLineMemoryRefs: [],
      },
    },
    save: {
      slot: SLOT,
      revision: 0,
      lastPersistedAt: null,
      dirty: false,
      authority: "server",
      lastLoadProof: {
        source: null,
        revision: null,
        playerId: null,
      },
    },
  };

  // ---- helpers ---------------------------------------------------------------

  function markDirty() {
    state.save.dirty = true;
  }

  function transitionTo(beat) {
    if (!BEATS.includes(beat)) {
      throw new Error(`Unknown AFTERSIGN scene.beat: ${beat}`);
    }
    if (state.scene.beat === beat) return;
    state.scene.beat = beat;
    onBeatChange(beat);
    // Any beat change makes state stale for the next quiescence await.
    idleTicket += 1;
  }

  function resolveIdleWaiters() {
    const waiters = Array.from(idleWaiters);
    idleWaiters.clear();
    for (const resolve of waiters) resolve();
  }

  function bumpIdle() {
    // Called after a synchronous state mutation completes.  Anything awaiting
    // waitForStoryIdle() past this microtask sees the settled state.
    Promise.resolve().then(resolveIdleWaiters);
  }

  function buildMemoryFor(outcome) {
    if (outcome === "sealed") {
      return {
        id: SEALED_MEMORY_ID,
        kind: "delivery-outcome",
        subject: "player",
        predicate: "delivered",
        object: "blue-packet-sealed",
        deliveryId: DELIVERY_ID,
        sessionId,
        source: "server",
      };
    }
    if (outcome === "opened") {
      return {
        id: OPENED_MEMORY_ID,
        kind: "delivery-outcome",
        subject: "player",
        predicate: "delivered",
        object: "blue-packet-opened",
        deliveryId: DELIVERY_ID,
        sessionId,
        source: "server",
      };
    }
    return null;
  }

  function recognitionLineFor(outcome) {
    if (breakMode === "wrong-io-line") {
      // Red polarity: speak the wrong branch's line.
      return outcome === "sealed" ? OPENED_LINE : SEALED_LINE;
    }
    return outcome === "sealed" ? SEALED_LINE : OPENED_LINE;
  }

  function snapshotForSave() {
    return {
      version: 1,
      playerId: state.player.id,
      revision: state.save.revision,
      flags: { ...state.player.flags },
      delivery: { ...state.delivery },
      memories: cloneMemories(state.npcs.io.memories),
      trustPosture: state.npcs.io.trustPosture,
      sceneBeat: state.scene.beat,
    };
  }

  function applyLoaded(snapshot, source) {
    if (!snapshot) return false;
    state.player.flags = { ...state.player.flags, ...(snapshot.flags ?? {}) };
    state.delivery = { ...state.delivery, ...(snapshot.delivery ?? {}) };
    state.npcs.io.memories = cloneMemories(snapshot.memories ?? []);
    if (typeof snapshot.trustPosture === "string") {
      state.npcs.io.trustPosture = snapshot.trustPosture;
    }
    state.save.revision = Number.isInteger(snapshot.revision) ? snapshot.revision : 0;
    state.save.lastPersistedAt = new Date(now()).toISOString();
    state.save.dirty = false;
    state.save.authority = source === "server" ? "server" : "local-fallback";
    state.save.lastLoadProof = {
      source,
      revision: state.save.revision,
      playerId: state.player.id,
    };
    return true;
  }

  function loadFromAuthoritative() {
    // Try server first, then local as degraded fallback.
    const fromServer = serverStore.load(state.player.id);
    if (fromServer) {
      applyLoaded(fromServer, "server");
      return "server";
    }
    const fromLocal = localStore.load(state.player.id);
    if (fromLocal) {
      applyLoaded(fromLocal, "local-fallback");
      return "local-fallback";
    }
    return null;
  }

  function refreshRecognitionLine() {
    const outcome = state.delivery.outcome;
    if (outcome !== "sealed" && outcome !== "opened") return;
    const memoryId = outcome === "sealed" ? SEALED_MEMORY_ID : OPENED_MEMORY_ID;
    const hasMemory = state.npcs.io.memories.some((m) => m.id === memoryId);
    if (!hasMemory) {
      // drop-memory red polarity: recognition line cannot cite a memory.
      state.npcs.io.lastLine = ARRIVAL_LINE;
      state.npcs.io.lastLineMemoryRefs = [];
      return;
    }
    state.npcs.io.lastLine = recognitionLineFor(outcome);
    state.npcs.io.lastLineMemoryRefs = [memoryId];
  }

  // ---- input surface ---------------------------------------------------------

  async function choose(choiceId) {
    if (!CHOICES.includes(choiceId)) {
      throw new Error(`Unknown AFTERSIGN choice: ${choiceId}`);
    }

    if (choiceId === "keep-sealed") {
      if (state.scene.beat === "arrival") transitionTo("packet-offered");
      transitionTo("packet-choice");
      sealIntent = "keep-sealed";
      state.npcs.io.lastLine = OFFERED_LINE;
      markDirty();
      bumpIdle();
      return;
    }

    if (choiceId === "open-packet") {
      if (state.scene.beat === "arrival") transitionTo("packet-offered");
      transitionTo("packet-choice");
      sealIntent = "open-packet";
      state.npcs.io.lastLine = OFFERED_LINE;
      markDirty();
      bumpIdle();
      return;
    }

    if (choiceId === "deliver-packet") {
      const outcome = sealIntent === "open-packet" ? "opened" : "sealed";
      state.delivery.outcome = outcome;
      state.player.flags.io_intro_seen = true;
      state.npcs.io.trustPosture = outcome === "sealed" ? "trusted-seal" : "useful-breach";
      state.npcs.io.lastLine = outcome === "sealed" ? DELIVERED_SEALED_LINE : DELIVERED_OPENED_LINE;
      state.npcs.io.lastLineMemoryRefs = [];
      transitionTo("packet-delivered");

      // Author the delivery-outcome memory on the SERVER side of the store.
      // In-memory server-store impl accepts an out-of-band memory upsert so
      // the memory carries source:'server' even before the next forceSave.
      if (breakMode !== "drop-memory") {
        const memory = buildMemoryFor(outcome);
        if (memory) {
          serverStore.upsertMemory(state.player.id, memory);
          state.npcs.io.memories = cloneMemories(
            dedupeMemories([...state.npcs.io.memories, memory])
          );
        }
      }
      markDirty();
      bumpIdle();
      return;
    }

    if (choiceId === "return-to-io") {
      state.player.flags.returned_after_first_session = true;
      transitionTo("io-return-recognition");
      refreshRecognitionLine();
      markDirty();
      bumpIdle();
      return;
    }
  }

  async function advance() {
    if (state.scene.beat === "arrival") transitionTo("packet-offered");
    bumpIdle();
  }

  async function forceSave() {
    const snapshot = snapshotForSave();
    snapshot.revision = state.save.revision + 1;

    if (breakMode === "local-only-save") {
      // Red polarity: acknowledge the save locally but skip the server write.
      localStore.save(state.player.id, snapshot);
    } else {
      serverStore.save(state.player.id, snapshot);
      localStore.save(state.player.id, snapshot);
    }

    state.save.revision = snapshot.revision;
    state.save.lastPersistedAt = new Date(now()).toISOString();
    state.save.dirty = false;
    state.save.authority = breakMode === "local-only-save" ? "local-fallback" : "server";
    bumpIdle();
  }

  async function forceReload(reloadOptions = {}) {
    if (reloadOptions.clearLocalState) {
      localStore.clear(state.player.id);
    }
    // Rotate session id — this reload is a returning session by definition.
    sessionCounter += 1;
    sessionId = `${SESSION_ID_PREFIX}${sessionCounter}`;
    sealIntent = null;
    state.scene.ready = false;

    // Reset transient state, then load from authoritative store.
    state.delivery.outcome = "unknown";
    state.npcs.io.memories = [];
    state.npcs.io.lastLine = ARRIVAL_LINE;
    state.npcs.io.lastLineMemoryRefs = [];
    state.npcs.io.trustPosture = "untested";
    state.scene.beat = "arrival";

    const loadedFrom = loadFromAuthoritative();
    // memories from the server are the canonical set for this reload.
    if (loadedFrom === "server") {
      const memories = serverStore.listMemories(state.player.id);
      if (breakMode === "drop-memory") {
        state.npcs.io.memories = [];
      } else {
        state.npcs.io.memories = cloneMemories(memories);
      }
      // Recover trust posture from delivery outcome if the snapshot didn't set it.
      if (state.delivery.outcome === "sealed") state.npcs.io.trustPosture = "trusted-seal";
      if (state.delivery.outcome === "opened") state.npcs.io.trustPosture = "useful-breach";
    }

    state.scene.ready = true;
    bumpIdle();
  }

  function waitForStoryIdle() {
    return new Promise((resolve) => {
      idleWaiters.add(resolve);
      // Resolve on next microtask so callers awaiting after a synchronous
      // mutation get a clean settle without needing a manual bump.
      Promise.resolve().then(resolveIdleWaiters);
    });
  }

  // ---- boot ------------------------------------------------------------------

  const initialLoad = loadFromAuthoritative();
  if (initialLoad === "server") {
    const memories = serverStore.listMemories(state.player.id);
    if (breakMode !== "drop-memory") {
      state.npcs.io.memories = cloneMemories(memories);
    }
    if (state.delivery.outcome === "sealed") state.npcs.io.trustPosture = "trusted-seal";
    if (state.delivery.outcome === "opened") state.npcs.io.trustPosture = "useful-breach";
  }
  state.scene.ready = true;

  const surface = {
    get version() {
      return state.version;
    },
    get build() {
      return state.build;
    },
    get scene() {
      return state.scene;
    },
    get player() {
      return state.player;
    },
    get delivery() {
      return state.delivery;
    },
    get npcs() {
      return state.npcs;
    },
    get save() {
      return state.save;
    },
    input: {
      choose,
      advance,
      forceSave,
      forceReload,
      waitForStoryIdle,
    },
    // Diagnostics — not part of the harness contract, but useful for host code
    // and for the red-polarity test to inspect what mode is active.
    _diagnostics: {
      breakMode,
      beats: BEATS,
      choices: CHOICES,
      outcomes: OUTCOMES,
      trustPostures: TRUST_POSTURES,
      breakModes: BREAK_MODES,
    },
  };

  return surface;
}

/**
 * Publish a FlagshipGameSurface on `target.__game`.  Replaces any prior
 * `__game` value — index.html should call this exactly once at boot.
 */
export function installFlagshipGameSurface(target, options = {}) {
  if (!target || typeof target !== "object") {
    throw new TypeError("installFlagshipGameSurface target must be an object");
  }
  const surface = createFlagshipGameSurface(options);
  target.__game = surface;
  return surface;
}

// ---- injectable stores -----------------------------------------------------

/**
 * @typedef {{
 *   load(playerId: string): SavedSnapshot|null,
 *   save(playerId: string, snapshot: SavedSnapshot): void,
 *   upsertMemory(playerId: string, memory: object): void,
 *   listMemories(playerId: string): Array<object>,
 * }} ServerStore
 */

/**
 * @typedef {{
 *   load(playerId: string): SavedSnapshot|null,
 *   save(playerId: string, snapshot: SavedSnapshot): void,
 *   clear(playerId: string): void,
 * }} LocalStore
 */

export function createInMemoryServerStore() {
  const snapshots = new Map();
  const memories = new Map();
  return {
    load(playerId) {
      const snap = snapshots.get(playerId);
      if (!snap) return null;
      const mems = memories.get(playerId) ?? [];
      return { ...cloneJson(snap), memories: cloneMemories(mems) };
    },
    save(playerId, snapshot) {
      snapshots.set(playerId, cloneJson(snapshot));
      // Sync any memories embedded in the snapshot into the server-side list.
      if (Array.isArray(snapshot.memories)) {
        memories.set(playerId, cloneMemories(snapshot.memories));
      }
    },
    upsertMemory(playerId, memory) {
      const list = memories.get(playerId) ?? [];
      const next = dedupeMemories([...list, { ...memory, source: "server" }]);
      memories.set(playerId, next);
    },
    listMemories(playerId) {
      return cloneMemories(memories.get(playerId) ?? []);
    },
    _reset() {
      snapshots.clear();
      memories.clear();
    },
  };
}

export function createLocalStorageLocalStore(storage) {
  const key = (playerId) => `aftersign.slice1.save.${playerId}`;
  return {
    load(playerId) {
      try {
        const raw = storage.getItem(key(playerId));
        return raw ? JSON.parse(raw) : null;
      } catch (_error) {
        return null;
      }
    },
    save(playerId, snapshot) {
      storage.setItem(key(playerId), JSON.stringify(snapshot));
    },
    clear(playerId) {
      storage.removeItem(key(playerId));
    },
  };
}

export function createMemoryLocalStore() {
  const map = new Map();
  return {
    load(playerId) {
      const raw = map.get(playerId);
      return raw ? cloneJson(raw) : null;
    },
    save(playerId, snapshot) {
      map.set(playerId, cloneJson(snapshot));
    },
    clear(playerId) {
      map.delete(playerId);
    },
  };
}

// ---- utilities -------------------------------------------------------------

/** Read a FLAGSHIP_BREAK_MODE hint from a URL or environment-like object. */
export function readBreakModeFromLocation(location) {
  if (!location || typeof location.search !== "string") return null;
  const params = new URLSearchParams(location.search);
  return normalizeBreakMode(params.get("FLAGSHIP_BREAK_MODE"));
}

function normalizeBreakMode(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  return BREAK_MODES.includes(value) ? value : null;
}

function normalizeString(value, fallback) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function cloneMemories(memories) {
  return memories.map((m) => ({ ...m }));
}

function dedupeMemories(memories) {
  const seen = new Set();
  const out = [];
  for (const m of memories) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push({ ...m });
  }
  return out;
}

export const AFTERSIGN_STORY_CONSTANTS = Object.freeze({
  SLUG,
  DELIVERY_ID,
  SCENE_ID,
  ACT_ID,
  BEATS,
  CHOICES,
  OUTCOMES,
  TRUST_POSTURES,
  BREAK_MODES,
  SEALED_MEMORY_ID,
  OPENED_MEMORY_ID,
  SEALED_LINE_FRAGMENT: "blue seal, unbroken",
  OPENED_LINE_FRAGMENT: "The seal did not",
});
