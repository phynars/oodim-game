// AFTERSIGN authoritative full-snapshot save backend (issue #2062,
// re-review from PR #2066).
//
// Ships two pieces, mirroring the sibling `playerMemoryBackend.ts`:
//
//   1. `handleAuthoritativeSaveRequest(request, env)` — a fetch-side
//      router called from the Worker entrypoint (`src/server.ts`). It
//      claims requests to `/aftersign/save/:playerId/:slot`, validates
//      the route segments + method, enforces a 1 MiB cap on PUT bodies
//      (parity with the vite dev middleware), and forwards to the DO
//      stub keyed by `${playerId}::${slot}`. Non-matching URLs return
//      `null` so the caller falls through to its next branch.
//
//   2. `AftersignAuthoritativeSave` — a Cloudflare Durable Object class
//      declared in `wrangler.jsonc` under
//      `[[durable_objects]] name = "AFTERSIGN_SAVE"` (migration `v3`,
//      `new_classes = ["AftersignAuthoritativeSave"]`). The constructor
//      takes the standard `(state, env)` pair; `fetch()` serves GET
//      (read snapshot), PUT (write snapshot), DELETE (clear snapshot)
//      against `state.storage`. Each DO instance IS one (playerId,
//      slot) pair — the record lives in `state.storage`, not in
//      isolate memory, so a GET after a PUT cannot 404 a committed
//      save when the isolate recycles.
//
// Why the DO substrate (not a module-level `Map`)? PR #2065's first
// draft kept writes in a `new Map()` on the Worker module — Workers
// isolates can drop that on recycle/eviction, so a GET after a PUT
// could silently 404 a committed save. The DO's `state.storage` is
// the correct substrate: durable, keyed per instance, and the router
// pins one instance per (playerId, slot) via `idFromName()`.
//
// 404 vs 503 split: a MISSING snapshot is a legitimate cold slot and
// returns 404 inside the DO; a storage FAILURE (e.g. the storage API
// throws) is a transient infra fault and returns 503. The router
// never conflates the two.
//
// Type shims: this module lives under `apps/web/src/aftersign/**`,
// whose tsconfig deliberately does NOT include
// `@cloudflare/workers-types`. The shim interfaces below describe the
// exact CF shapes the runtime dispatches against — same shape wrangler
// binds at deploy time — without pulling the ambient CF types into
// every aftersign module. `src/server.ts` (repo-root Worker entry,
// typechecked with CF types in scope via wrangler's bundler) imports
// and calls this module with real bindings.

/** Structural shape of `env.AFTERSIGN_SAVE` (a CF DurableObjectNamespace).
 *  Kept as a local interface so this file typechecks under the aftersign
 *  tsconfig lane (no `@cloudflare/workers-types`). */
export interface AftersignAuthoritativeSaveNamespace {
  idFromName(name: string): { toString(): string };
  get(id: { toString(): string }): { fetch(request: Request): Promise<Response> };
}

export interface AftersignAuthoritativeSaveEnv {
  AFTERSIGN_SAVE: AftersignAuthoritativeSaveNamespace;
}

/** Structural shape of CF's `DurableObjectStorage`. `state.storage` on
 *  the deployed DO satisfies this at runtime. `delete` is optional in
 *  the sense that it may be absent on some fakes, but the real runtime
 *  always provides it. */
interface DurableObjectStorage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
}

/** Structural shape of CF's `DurableObjectState`. */
export interface AftersignAuthoritativeSaveState {
  storage: DurableObjectStorage;
}

/** The sentinel field we store the snapshot under in `state.storage`. */
const SNAPSHOT_KEY = "snapshot";

/** Route prefix that this backend owns. The router matches
 *  `/aftersign/save/:playerId/:slot` exactly — two trailing segments,
 *  URL-decoded. */
export const AUTHORITATIVE_SAVE_PATH_PREFIX = "/aftersign/save/";

/** 1 MiB cap on PUT bodies — parity with the vite dev middleware's
 *  bound. Enforced BOTH via `content-length` (short-circuit, cheap)
 *  AND via realised body length (defensive — the header is advisory
 *  and a mendacious client can lie). */
const MAX_SAVE_BYTES = 1_048_576;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Parse `/aftersign/save/:playerId/:slot` from a URL. Returns
 *  `{ playerId, slot }` on exact match, `"malformed"` when the path
 *  starts with the prefix but has the wrong segment count or an empty
 *  segment, or `null` when the path doesn't belong to this backend. */
function parseRoute(
  pathname: string,
): { playerId: string; slot: string } | "malformed" | null {
  if (!pathname.startsWith(AUTHORITATIVE_SAVE_PATH_PREFIX)) return null;
  const tail = pathname.slice(AUTHORITATIVE_SAVE_PATH_PREFIX.length);
  // Reject trailing slash / empty tail / nested paths. Must be exactly
  // two non-empty segments.
  const segments = tail.split("/");
  if (segments.length !== 2) return "malformed";
  const [rawPlayer, rawSlot] = segments;
  if (!rawPlayer || !rawSlot) return "malformed";
  let playerId: string;
  let slot: string;
  try {
    playerId = decodeURIComponent(rawPlayer);
    slot = decodeURIComponent(rawSlot);
  } catch {
    return "malformed";
  }
  if (!playerId || !slot) return "malformed";
  return { playerId, slot };
}

/**
 * Route an authoritative-save API request to the durable record for
 * `(playerId, slot)`. Called from the Worker `fetch` entrypoint
 * (`src/server.ts`). Returns `null` when the URL is not under
 * `/aftersign/save/` so the caller can fall through to the next
 * branch.
 *
 * Pre-DO guards enforced here (fail fast at the router, cheap):
 *   - Non-matching path → `null`
 *   - Matching prefix but malformed segments → 400
 *   - Method not GET/PUT/DELETE → 405 with `Allow: GET, PUT, DELETE`
 *   - PUT with `content-length` > 1 MiB → 413 (header-advised cap)
 *   - PUT whose realised body exceeds 1 MiB → 413 (defensive cap)
 *
 * Everything else (JSON shape validation, 404-vs-200, DELETE
 * idempotency, 503 on storage failure) lives inside the DO so the
 * record and the decision stay co-located.
 */
export async function handleAuthoritativeSaveRequest(
  request: Request,
  env: AftersignAuthoritativeSaveEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const parsed = parseRoute(url.pathname);
  if (parsed === null) return null;
  if (parsed === "malformed") {
    return json({ error: "Invalid save route" }, 400);
  }

  const method = request.method;
  if (method !== "GET" && method !== "PUT" && method !== "DELETE") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        "content-type": "application/json",
        allow: "GET, PUT, DELETE",
      },
    });
  }

  // 1 MiB cap on PUT — pre-DO so we don't spend DO CPU/storage on an
  // oversized body. Both branches respond 413 for parity with the vite
  // dev middleware.
  let forwarded = request;
  if (method === "PUT") {
    const declared = request.headers.get("content-length");
    if (declared !== null) {
      const n = Number(declared);
      if (Number.isFinite(n) && n > MAX_SAVE_BYTES) {
        return json({ error: "Save payload too large" }, 413);
      }
    }
    // `content-length` is advisory. Read + re-wrap once so the DO
    // sees a request with the body intact AND we can bound the
    // realised byte length.
    let bodyText: string;
    try {
      bodyText = await request.text();
    } catch {
      return json({ error: "Invalid save payload" }, 400);
    }
    const realisedBytes = new TextEncoder().encode(bodyText).byteLength;
    if (realisedBytes > MAX_SAVE_BYTES) {
      return json({ error: "Save payload too large" }, 413);
    }
    forwarded = new Request(request.url, {
      method: "PUT",
      headers: request.headers,
      body: bodyText,
    });
  }

  const id = env.AFTERSIGN_SAVE.idFromName(`${parsed.playerId}::${parsed.slot}`);
  return env.AFTERSIGN_SAVE.get(id).fetch(forwarded);
}

/**
 * Cloudflare Durable Object: one authoritative save record per
 * `(playerId, slot)` pair.
 *
 * Wired in `wrangler.jsonc`:
 *   `[[durable_objects]] { name: "AFTERSIGN_SAVE",
 *      class_name: "AftersignAuthoritativeSave" }`
 * and re-exported from `src/server.ts` so wrangler can locate the
 * class during bundle/deploy. Migration tag `v3` registers the class.
 *
 * The constructor takes the standard `(state, env)` pair Cloudflare
 * dispatches with. `env` is currently unused — declared for shape
 * conformance and so future extensions don't need a ctor change.
 *
 * `fetch()` wraps the storage I/O in a single try/catch so a storage
 * exception becomes a 503 ("transient — retry"), distinct from a 404
 * (cold slot, a legitimate "nothing to load") the GET branch returns.
 */
export class AftersignAuthoritativeSave {
  private readonly state: AftersignAuthoritativeSaveState;

  constructor(
    state: AftersignAuthoritativeSaveState,
    _env: AftersignAuthoritativeSaveEnv,
  ) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    try {
      switch (request.method) {
        case "GET": {
          // `has()` would be ideal but isn't on the structural shape;
          // use a tombstone sentinel object alongside the payload so
          // we can distinguish "never written" (undefined) from
          // "written as null" (a legitimate cleared snapshot).
          const slot = await this.state.storage.get<{ payload: unknown }>(
            SNAPSHOT_KEY,
          );
          if (slot === undefined) {
            return json({ error: "Save slot not found" }, 404);
          }
          return json({ payload: slot.payload });
        }

        case "PUT": {
          let body: unknown;
          try {
            body = await request.json();
          } catch {
            return json({ error: "Invalid save payload" }, 400);
          }
          if (
            !body ||
            typeof body !== "object" ||
            Array.isArray(body) ||
            !("payload" in (body as Record<string, unknown>))
          ) {
            return json({ error: "Missing save payload" }, 400);
          }
          const payload = (body as { payload: unknown }).payload;
          // Wrap in a sentinel object so a stored `null` payload is
          // distinguishable from an absent record on subsequent GETs.
          await this.state.storage.put(SNAPSHOT_KEY, { payload });
          return new Response(null, { status: 204 });
        }

        case "DELETE": {
          // Idempotent: deleting an absent record is still 204.
          await this.state.storage.delete(SNAPSHOT_KEY);
          return new Response(null, { status: 204 });
        }

        default:
          return new Response(
            JSON.stringify({ error: "Method not allowed" }),
            {
              status: 405,
              headers: {
                "content-type": "application/json",
                allow: "GET, PUT, DELETE",
              },
            },
          );
      }
    } catch (error) {
      console.error("Aftersign authoritative save storage failure", error);
      return json({ error: "Save storage temporarily unavailable" }, 503);
    }
  }
}
