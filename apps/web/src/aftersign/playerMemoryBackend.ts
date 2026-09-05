// AFTERSIGN authoritative player-memory backend (issue #1635).
//
// Ships two pieces:
//
//   1. `handlePlayerMemoryRequest(request, env)` — a fetch-side router
//      called from the shipped Worker entrypoint (`src/server.ts`). It
//      claims requests to `/player-memory`, requires an `x-player-id`
//      header (the durable identity), and forwards to the DO stub keyed
//      by that identity. Non-matching URLs return `null` so the caller
//      falls through to its next branch (assets / WS / etc.).
//
//   2. `AftersignPlayerMemory` — a Cloudflare Durable Object class
//      declared in `wrangler.jsonc` under
//      `[[durable_objects]] name = "PLAYER_MEMORY"` (migration `v2`,
//      `new_classes = ["AftersignPlayerMemory"]`). The constructor
//      takes the standard `(state, env)` pair; `fetch()` serves GET
//      (read facts) and POST (merge-upsert facts) against
//      `state.storage`, so records survive DO eviction — and therefore
//      any browser localStorage clear on the client.
//
// The endpoint contract mirrors the existing localStorage fact shape:
// facts are a flat `Record<string, unknown>` under the key `facts`,
// returned as `{ facts: {...} }` on both GET and POST. POSTing
// `{a: 1}` then `{b: 2}` for the same identity yields
// `{ facts: { a: 1, b: 2 } }` on the next GET — same merge semantics
// the local writer uses when patching delivery-outcome / route-attention
// facts across sessions.
//
// Type shims: this module lives under `apps/web/src/aftersign/**`, whose
// tsconfig (`aftersign/tsconfig.apps-web.json`) deliberately does NOT
// include `@cloudflare/workers-types` (the aftersign lane stays free of
// Worker-runtime globals). The shim interfaces below describe the exact
// CF shapes the runtime dispatches against — same shape wrangler binds
// at deploy time — without pulling the ambient CF types into every
// aftersign module. `src/server.ts` (repo-root Worker entry, typechecked
// with CF types in scope via wrangler's bundler) imports and calls this
// module with real bindings.

export type AftersignPlayerMemoryFacts = Record<string, unknown>;

/** Structural shape of `env.PLAYER_MEMORY` (a CF DurableObjectNamespace).
 *  Kept as a local interface so this file typechecks under the aftersign
 *  tsconfig lane (no `@cloudflare/workers-types`). */
export interface AftersignPlayerMemoryNamespace {
  idFromName(name: string): { toString(): string };
  get(id: { toString(): string }): { fetch(request: Request): Promise<Response> };
}

export interface AftersignPlayerMemoryEnv {
  PLAYER_MEMORY: AftersignPlayerMemoryNamespace;
}

/** Structural shape of CF's `DurableObjectStorage`. `state.storage` on
 *  the deployed DO satisfies this at runtime. */
interface DurableObjectStorage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

/** Structural shape of CF's `DurableObjectState`. */
export interface AftersignDurableObjectState {
  storage: DurableObjectStorage;
}

const FACTS_KEY = "facts";
export const PLAYER_MEMORY_PATH = "/player-memory";
export const PLAYER_IDENTITY_HEADER = "x-player-id";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function identityFrom(request: Request): string | null {
  const identity = request.headers.get(PLAYER_IDENTITY_HEADER);
  return identity?.trim() || null;
}

/**
 * Route a player-memory API request to the durable record for its stable
 * player identity. Called from the Worker `fetch` entrypoint
 * (`src/server.ts`). Returns `null` when the URL is not `/player-memory`
 * so the caller can fall through to the next branch.
 */
export async function handlePlayerMemoryRequest(
  request: Request,
  env: AftersignPlayerMemoryEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== PLAYER_MEMORY_PATH) return null;

  if (request.method !== "GET" && request.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  const identity = identityFrom(request);
  if (!identity) {
    return json({ error: `${PLAYER_IDENTITY_HEADER} is required` }, 400);
  }

  const id = env.PLAYER_MEMORY.idFromName(identity);
  return env.PLAYER_MEMORY.get(id).fetch(request);
}

/**
 * Cloudflare Durable Object: one authoritative memory record per player.
 *
 * Wired in `wrangler.jsonc`:
 *   `[[durable_objects]] { name: "PLAYER_MEMORY",
 *      class_name: "AftersignPlayerMemory" }`
 * and re-exported from `src/server.ts` so wrangler can locate the class
 * during bundle/deploy.
 *
 * The constructor takes the standard `(state, env)` pair Cloudflare
 * dispatches with. `env` is currently unused — declared for shape
 * conformance and so future extensions (e.g. cross-DO fanout via
 * another binding) don't need a ctor signature change.
 */
export class AftersignPlayerMemory {
  private readonly state: AftersignDurableObjectState;

  constructor(state: AftersignDurableObjectState, _env: AftersignPlayerMemoryEnv) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method === "GET") {
      const facts =
        (await this.state.storage.get<AftersignPlayerMemoryFacts>(FACTS_KEY)) ??
        {};
      return json({ facts });
    }

    if (request.method === "POST") {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ error: "invalid JSON" }, 400);
      }
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return json({ error: "facts must be an object" }, 400);
      }

      const existing =
        (await this.state.storage.get<AftersignPlayerMemoryFacts>(FACTS_KEY)) ??
        {};
      const facts = { ...existing, ...(body as AftersignPlayerMemoryFacts) };
      await this.state.storage.put(FACTS_KEY, facts);
      return json({ facts });
    }

    return json({ error: "method not allowed" }, 405);
  }
}
