// Client adapter for the deployed player-memory Durable Object.
//
// Migration boundary: the authoritative save remains the complete playable
// snapshot and continues mirroring recognition facts for legacy restore paths.
// Player-memory is additionally read and written for returning-visit recognition;
// it is not yet the sole durable owner of those facts.

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

export async function writePlayerMemory({ playerId, facts, fetchImpl = fetch }) {
  const response = await fetchImpl(PLAYER_MEMORY_PATH, {
    method: "POST",
    headers: { ...headersFor(playerId), "content-type": "application/json" },
    body: JSON.stringify(facts),
  });
  return readJson(response);
}
