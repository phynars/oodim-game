// Server-authoritative save client and HTTP handler for AFTERSIGN.
//
// Client contract:
//   GET    /aftersign/save/:playerId/:slot → 200 { payload } | 404
//   PUT    /aftersign/save/:playerId/:slot → 204 (body: { payload })
//   DELETE /aftersign/save/:playerId/:slot → 204

const SAVE_ENDPOINT_BASE = "/aftersign/save";
const saveStore = new Map();

function encodeKey({ playerId, slot }) {
  return `${encodeURIComponent(playerId)}/${encodeURIComponent(slot)}`;
}

function isBrowser() {
  return typeof window !== "undefined" && typeof window.fetch === "function";
}

function saveKey(playerId, slot) {
  return `${playerId}\u0000${slot}`;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Handles the authoritative save HTTP contract. Returns null for paths outside
 * this endpoint so callers can continue normal routing.
 */
export async function handleAuthoritativeSaveRequest(request) {
  const url = new URL(request.url);
  const match = /^\/aftersign\/save\/([^/]+)\/([^/]+)$/.exec(url.pathname);
  if (!match) return null;

  let playerId;
  let slot;
  try {
    playerId = decodeURIComponent(match[1]);
    slot = decodeURIComponent(match[2]);
  } catch {
    return jsonResponse({ error: "invalid save key" }, 400);
  }
  if (!playerId || !slot) return jsonResponse({ error: "invalid save key" }, 400);

  const key = saveKey(playerId, slot);
  if (request.method === "GET") {
    if (!saveStore.has(key)) return new Response(null, { status: 404 });
    return jsonResponse({ payload: saveStore.get(key) });
  }

  if (request.method === "PUT") {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "invalid JSON" }, 400);
    }
    if (typeof body !== "object" || body === null || !("payload" in body)) {
      return jsonResponse({ error: "payload is required" }, 400);
    }
    saveStore.set(key, body.payload);
    return new Response(null, { status: 204 });
  }

  if (request.method === "DELETE") {
    saveStore.delete(key);
    return new Response(null, { status: 204 });
  }

  return new Response(null, {
    status: 405,
    headers: { allow: "GET, PUT, DELETE" },
  });
}

export async function readAuthoritativeSave({ slot, playerId }) {
  if (!isBrowser()) return null;
  try {
    const response = await window.fetch(`${SAVE_ENDPOINT_BASE}/${encodeKey({ playerId, slot })}`, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Authoritative save read failed: HTTP ${response.status}`);
    }
    const body = await response.json();
    return body?.payload ?? null;
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export async function writeAuthoritativeSave({ slot, playerId, payload }) {
  if (!isBrowser()) return;
  const response = await window.fetch(`${SAVE_ENDPOINT_BASE}/${encodeKey({ playerId, slot })}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ payload }),
  });
  if (!response.ok) {
    throw new Error(`Authoritative save write failed: HTTP ${response.status}`);
  }
}

export async function clearAuthoritativeSave({ slot, playerId }) {
  if (!isBrowser()) return;
  const response = await window.fetch(`${SAVE_ENDPOINT_BASE}/${encodeKey({ playerId, slot })}`, {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Authoritative save delete failed: HTTP ${response.status}`);
  }
}
