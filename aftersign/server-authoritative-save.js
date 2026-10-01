// Server-authoritative save CLIENT for AFTERSIGN.
//
// The save is served by a real HTTP endpoint. In vite dev/preview the
// endpoint is mounted on the Node process (see
// `aftersign/vite.config.ts` → aftersignAuthoritativeSaveMiddleware).
// In production (game.oodim.com Worker) the SAME HTTP contract is
// served by a Cloudflare Durable Object class
// (`AftersignAuthoritativeSave`, see
// `apps/web/src/aftersign/authoritativeSaveBackend.ts`), re-exported +
// routed from `src/server.ts`. The storage substrate differs; the HTTP
// shape is identical — the client code below does not know or care
// which backend it is talking to.
//
// Why not a `new Map()` on the Worker? Workers isolates are per-POP
// and get recycled/evicted between requests, so a module-level Map
// cannot be durable (a GET after a PUT can land on a cold isolate and
// 404 a committed save). A Durable Object's `state.storage` is the
// correct substrate — it survives isolate recycling, cross-POP
// routing, and anything else short of an account-level data loss.
// See PR #2065 re-review (AI008). The backend module exists next to
// `AftersignPlayerMemory` precisely because they share this failure
// mode: a browser-visible "server authority" stamp has to be backed by
// genuinely-cross-request storage, not process-local state.
//
// Contract with the harness (docs/flagship/story-state-contract.md):
//   - `readAuthoritativeSave` returns the last payload written for
//     ${playerId}::${slot}, or null on a cold slot / server error.
//   - `writeAuthoritativeSave` persists the payload atomically;
//     concurrent writes overwrite in arrival order (single-writer per
//     slot in practice).
//   - `clearAuthoritativeSave` removes the row for that ${playerId}::${slot}
//     — used by reloadFromSave({ clearLocalState: true }) to wipe durable
//     state for the vertical slice.
//
// Endpoint shape:
//   GET    /aftersign/save/:playerId/:slot   → 200 { payload } | 404
//   PUT    /aftersign/save/:playerId/:slot   → 204 (body: { payload })
//   DELETE /aftersign/save/:playerId/:slot   → 204
//
// The client is deliberately small: no retry, no queue. Playwright specs run
// against localhost; a fetch failure means the vite server is down, and
// falling back to localStorage would silently defeat the durability proof.

const SAVE_ENDPOINT_BASE = "/aftersign/save";

function encodeKey({ playerId, slot }) {
  return `${encodeURIComponent(playerId)}/${encodeURIComponent(slot)}`;
}

function isBrowser() {
  return typeof window !== "undefined" && typeof window.fetch === "function";
}

export async function readAuthoritativeSave({ slot, playerId }) {
  if (!isBrowser()) return null;
  try {
    const response = await window.fetch(
      `${SAVE_ENDPOINT_BASE}/${encodeKey({ playerId, slot })}`,
      { method: "GET" },
    );
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Authoritative save read failed: HTTP ${response.status}`);
    }
    const body = await response.json();
    // Endpoint returns { payload: ... } on hit; treat a missing payload as null
    // so the caller's `|| null` fallback still routes correctly.
    return body?.payload ?? null;
  } catch (err) {
    // Surface the failure to the caller — the durable-load path must not
    // silently reconstruct from local state when the server is unreachable
    // (that would re-introduce exactly the defect this file exists to fix).
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
  // 404 is fine — DELETE of a missing row is a no-op success.
  if (!response.ok && response.status !== 404) {
    throw new Error(`Authoritative save delete failed: HTTP ${response.status}`);
  }
}
