// AFTERSIGN authoritative full-snapshot save backend (PR #2065 re-review).
//
// Why this file replaces a module-level `Map` on the Worker:
//
// The first draft of the Worker-side save handler kept writes in a
// `new Map()` at module scope inside `aftersign/server-authoritative-save.js`.
// Soren's review on #2065 rejected that (AI008 — unverified runtime
// premise): Cloudflare Workers isolates are per-location and get
// recycled or evicted between requests, and different POPs run
// separate isolates. A module-level Map therefore CANNOT be the
// durable store that the "authority: server" stamp claims — a GET
// after a PUT can land on a cold isolate, see an empty Map, and 404
// a save that the harness proved was committed. That's the exact
// "stamping server-authority on browser-local state" failure mode
// the authoritative-save contract exists to prevent, re-introduced
// one layer up.
//
// Correct substrate: a Durable Object, same as the neighbouring
// `AftersignPlayerMemory` (issue #1635). One DO instance per
// `${playerId}::${slot}` pair (keyed via idFromName); payload persisted
// in `state.storage`, which Cloudflare guarantees to survive isolate
// recycling, cross-POP routing, and anything else short of an
// account-level data loss event.
//
// Contract this module serves (unchanged from the vite middleware):
//   GET    /aftersign/save/:playerId/:slot → 200 { payload } | 404
//   PUT    /aftersign/save/:playerId/:slot → 204 (body: { payload })
//   DELETE /aftersign/save/:playerId/:slot → 204
//
// Size cap parity: PUT bodies are capped at 1 MiB, matching the vite
// middleware (`aftersign/vite.config.ts` → `readJsonBody`). A
// well-formed slice save is <10 KiB; the cap bounds memory and makes
// an abusive client an obvious 413 instead of an obscure DO storage
// error.
//
// Type shims: this module lives under `apps/web/src/aftersign/**`,
// whose tsconfig (`aftersign/tsconfig.apps-web.json`) deliberately
// omits `@cloudflare/workers-types`. The local interfaces below
// describe the exact CF shapes the runtime dispatches against —
// same shape wrangler binds at deploy time — without pulling the
// ambient CF types into every aftersign module. The structural
// contract matches `playerMemoryBackend.ts`.

export type AuthoritativeSavePayload = unknown;

/** Structural shape of `env.AFTERSIGN_SAVE` (a CF DurableObjectNamespace). */
export interface AftersignAuthoritativeSaveNamespace {
  idFromName(name: string): { toString(): string };
  get(id: { toString(): string }): { fetch(request: Request): Promise<Response> };
}

export interface AftersignAuthoritativeSaveEnv {
  AFTERSIGN_SAVE: AftersignAuthoritativeSaveNamespace;
}

/** Structural shape of CF's `DurableObjectStorage`. */
interface DurableObjectStorage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
}

/** Structural shape of CF's `DurableObjectState`. */
export interface AftersignAuthoritativeSaveState {
  storage: DurableObjectStorage;
}

const PAYLOAD_KEY = "payload";
const SAVE_PATH_PATTERN = /^\/aftersign\/save\/([^/]+)\/([^/]+)$/;
// 1 MiB — matches `aftersign/vite.config.ts` readJsonBody cap. A
// well-formed vertical-slice save is <10 KiB; this bound keeps a
// pathological client from parking large blobs in the DO.
const MAX_PUT_BYTES = 1_048_576;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function emptyResponse(status: number, headers?: Record<string, string>): Response {
  return new Response(null, { status, headers });
}

function parseSaveRoute(url: URL): { playerId: string; slot: string } | null {
  const match = SAVE_PATH_PATTERN.exec(url.pathname);
  if (!match) return null;
  try {
    const playerId = decodeURIComponent(match[1]);
    const slot = decodeURIComponent(match[2]);
    if (!playerId || !slot) return null;
    return { playerId, slot };
  } catch {
    return null;
  }
}

/**
 * Route an authoritative-save request to the DO keyed by
 * `${playerId}::${slot}`. Called from the Worker `fetch` entrypoint
 * (`src/server.ts`). Returns `null` when the URL is not under
 * `/aftersign/save/:playerId/:slot` so the caller can fall through
 * to the next branch.
 *
 * The parse happens here (not inside the DO) so a malformed route
 * never consumes an idFromName / DO instantiation.
 */
export async function handleAuthoritativeSaveRequest(
  request: Request,
  env: AftersignAuthoritativeSaveEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/aftersign/save/")) return null;

  const route = parseSaveRoute(url);
  if (!route) return jsonResponse({ error: "invalid save key" }, 400);

  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "PUT" && method !== "DELETE") {
    return emptyResponse(405, { allow: "GET, PUT, DELETE" });
  }

  const id = env.AFTERSIGN_SAVE.idFromName(`${route.playerId}::${route.slot}`);
  return env.AFTERSIGN_SAVE.get(id).fetch(request);
}

/**
 * Cloudflare Durable Object: one authoritative save record per
 * `${playerId}::${slot}` pair.
 *
 * Wired in `wrangler.jsonc`:
 *   `[[durable_objects]] { name: "AFTERSIGN_SAVE",
 *      class_name: "AftersignAuthoritativeSave" }`
 * and re-exported from `src/server.ts` so wrangler can locate the
 * class during bundle/deploy.
 *
 * The constructor takes the standard `(state, env)` pair; `env` is
 * declared for shape conformance even though this DO does not fan
 * out to other bindings.
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
    const method = request.method.toUpperCase();

    if (method === "GET") {
      const stored = await this.state.storage.get<AuthoritativeSavePayload>(
        PAYLOAD_KEY,
      );
      if (stored === undefined) return emptyResponse(404);
      return jsonResponse({ payload: stored });
    }

    if (method === "PUT") {
      // Enforce the 1 MiB cap before parsing so we don't buffer a
      // multi-MiB JSON only to reject it. `content-length` is
      // advisory (clients can lie), so we also cap the realised
      // text length below.
      const declared = request.headers.get("content-length");
      if (declared !== null) {
        const asNumber = Number(declared);
        if (Number.isFinite(asNumber) && asNumber > MAX_PUT_BYTES) {
          return jsonResponse({ error: "payload too large" }, 413);
        }
      }

      let text: string;
      try {
        text = await request.text();
      } catch {
        return jsonResponse({ error: "failed to read body" }, 400);
      }
      if (text.length > MAX_PUT_BYTES) {
        return jsonResponse({ error: "payload too large" }, 413);
      }

      let body: unknown;
      try {
        body = text.length === 0 ? null : JSON.parse(text);
      } catch {
        return jsonResponse({ error: "invalid JSON" }, 400);
      }
      if (typeof body !== "object" || body === null || !("payload" in body)) {
        return jsonResponse({ error: "payload is required" }, 400);
      }

      await this.state.storage.put(
        PAYLOAD_KEY,
        (body as { payload: AuthoritativeSavePayload }).payload,
      );
      return emptyResponse(204);
    }

    if (method === "DELETE") {
      await this.state.storage.delete(PAYLOAD_KEY);
      return emptyResponse(204);
    }

    return emptyResponse(405, { allow: "GET, PUT, DELETE" });
  }
}
