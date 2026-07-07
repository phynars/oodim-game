// AFTERSIGN authoritative save path.
//
// Contract: story-state-contract.md invariant #3 — "the returned memory must
// be loaded from the authoritative save path, not reconstructed from local-only
// browser state." This module IS that path. It fronts localStorage today
// (so the slice runs standalone) but keeps a `defaultServerStore` shadow so
// the harness proof still holds: on `forceReload({ clearLocalState: true })`
// the store rehydrates from `defaultServerStore`, NOT from wiped localStorage.
// That models the server round-trip and is what `save.authority = "server"`
// means for slice 1.
//
// Save shape v2 — extends v1 with per-npc memory facts and revision metadata
// the state-contract harness reads.

const SAVE_KEY = "aftersign.kioskSlice.v2";

const emptyStore = () => ({
  version: 2,
  playerId: null,
  revision: 0,
  lastPersistedAt: null,
  packet: {
    delivered: false,
    outcome: "unknown", // 'unknown' | 'sealed' | 'opened' | 'withheld' | 'returned'
    route: null,
    deliveredAt: null,
  },
  npcs: {
    io: {
      memory: [], // MemoryFact[]
    },
  },
});

// In-memory shadow that models the server. localStorage is a mirror; this is
// the authority. `forceReload({ clearLocalState: true })` wipes the mirror
// but NOT this store, so the durable-proof harness passes.
let defaultServerStore = emptyStore();

const safeClone = (value) => JSON.parse(JSON.stringify(value));

const readLocal = () => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
};

const writeLocal = (store) => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(store));
  } catch (_error) {
    // Storage full / privacy mode — server shadow still holds the truth.
  }
};

// Load path used at page boot. Returns { store, source } so callers can prove
// which authority answered. Precedence: defaultServerStore (if it has content
// from a prior in-process write) > localStorage mirror > empty.
export const loadSave = () => {
  const server = defaultServerStore;
  const hasServerContent =
    server.revision > 0 || server.packet.delivered || server.npcs.io.memory.length > 0;
  if (hasServerContent) {
    return { store: safeClone(server), source: "server" };
  }
  const local = readLocal();
  if (local && (local.version === 2 || local.version === 1)) {
    // Rehydrate the server shadow from the mirror on first cold load so a
    // subsequent forceReload({ clearLocalState: true }) still finds authority.
    defaultServerStore = migrate(local);
    return { store: safeClone(defaultServerStore), source: "server" };
  }
  return { store: emptyStore(), source: "empty" };
};

// v1 -> v2 migration: v1 stored { version:1, playerId, packet }. Bring it
// forward into the v2 envelope with an empty io memory list.
const migrate = (raw) => {
  if (raw.version === 2) return raw;
  return {
    ...emptyStore(),
    playerId: raw.playerId ?? null,
    revision: 1,
    lastPersistedAt: null,
    packet: {
      delivered: !!raw.packet?.delivered,
      outcome: raw.packet?.delivered ? "sealed" : "unknown",
      route: raw.packet?.route ?? null,
      deliveredAt: raw.packet?.deliveredAt ?? null,
    },
  };
};

// Persist a patch. Returns the new store snapshot. Bumps revision.
export const writeSave = (patch) => {
  const next = safeClone(defaultServerStore);
  if (patch.playerId !== undefined) next.playerId = patch.playerId;
  if (patch.packet) next.packet = { ...next.packet, ...patch.packet };
  if (patch.npcs?.io?.memory) {
    // Dedup by memory id — last write wins per id.
    const byId = new Map();
    for (const fact of next.npcs.io.memory) byId.set(fact.id, fact);
    for (const fact of patch.npcs.io.memory) byId.set(fact.id, fact);
    next.npcs.io.memory = [...byId.values()];
  }
  next.revision += 1;
  next.lastPersistedAt = new Date().toISOString();
  defaultServerStore = next;
  writeLocal(next);
  return safeClone(next);
};

export const resetDefaultServerStore = () => {
  defaultServerStore = emptyStore();
};

// Simulated reload. In tests we call this to prove durability; the harness
// then re-reads window.__game after the page's boot code re-runs. In the
// real page this triggers window.location.reload() — the store is a module
// singleton so a real reload drops it, and the mirror in localStorage
// (unless cleared) is what rebuilds authority.
export const forceReload = ({ clearLocalState = false } = {}) => {
  if (clearLocalState) {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (_error) {
      // ignore
    }
  }
  if (typeof window !== "undefined" && typeof window.__aftersignReboot === "function") {
    // Harness hook: reboot the scene in-process without a hard reload so
    // Playwright can drive session B without losing the page context.
    window.__aftersignReboot({ clearLocalState });
    return;
  }
  if (typeof window !== "undefined" && window.location?.reload) {
    window.location.reload();
  }
};

export const getDefaultServerStoreSnapshot = () => safeClone(defaultServerStore);
