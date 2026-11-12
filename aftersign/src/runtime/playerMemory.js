// Client adapter for the deployed player-memory Durable Object.
//
// Migration boundary: the authoritative save remains the complete playable
// snapshot and continues mirroring recognition facts for legacy restore paths.
// Player-memory is a best-effort replica written after each committed save.
// On boot the save's memory wins whenever present; player-memory is read only
// as a fallback when the save carries no memory, so a failed (quota/429)
// replica write can never restore stale memory over a fresher save.

const PLAYER_MEMORY_PATH = "/player-memory";
const PLAYER_IDENTITY_HEADER = "x-player-id";

function headersFor(playerId) {
  if (typeof playerId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(playerId)) {
    throw new TypeError("playerId must be a safe non-empty identifier");
  }
  return { [PLAYER_IDENTITY_HEADER]: playerId };
}

async function readJson(response) {
  if (!response.ok) throw new Error(`player-memory request failed (${response.status})`);
  return response.json();
}

export async function readPlayerMemory({ playerId, fetchImpl = fetch }) {
  const response = await fetchImpl(PLAYER_MEMORY_PATH, {
    method: "GET", headers: headersFor(playerId),
  });
  return readJson(response);
}

// #2766 — choose the Io memory a booting slot hydrates with.
// Player-memory is keyed by player id only (no slot), so it must never seed
// a slot that has no authoritative save of its own: a cold slot would
// otherwise inherit another slot's recognition facts (the live
// save-slot-isolation / flagship-reload failures). Order:
//   1. save.memory (non-empty)
//   2. save.npcs.io.memory (non-empty)
//   3. player-memory replica — ONLY when this slot has a save
//   4. save.npcs.io.memory (possibly empty) / []
export function selectBootIoMemory({ stored, durableIoMemory }) {
  const copy = (value) => JSON.parse(JSON.stringify(value));
  if (Array.isArray(stored?.memory) && stored.memory.length > 0) {
    return copy(stored.memory);
  }
  const npcIoMemory = stored?.npcs?.io?.memory;
  if (Array.isArray(npcIoMemory) && npcIoMemory.length > 0) {
    return copy(npcIoMemory);
  }
  if (stored && typeof stored === "object" && Array.isArray(durableIoMemory)) {
    return copy(durableIoMemory);
  }
  return Array.isArray(npcIoMemory) ? copy(npcIoMemory) : [];
}

export async function writePlayerMemory({ playerId, facts, fetchImpl = fetch }) {
  const response = await fetchImpl(PLAYER_MEMORY_PATH, {
    method: "POST",
    headers: { ...headersFor(playerId), "content-type": "application/json" },
    body: JSON.stringify(facts),
  });
  return readJson(response);
}
