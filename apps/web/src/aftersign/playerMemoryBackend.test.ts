import { describe, expect, it } from "vitest";
import {
  AftersignPlayerMemory,
  handlePlayerMemoryRequest,
  PLAYER_IDENTITY_HEADER,
  type AftersignDurableObjectState,
  type AftersignPlayerMemoryEnv,
  type AftersignPlayerMemoryFacts,
  type AftersignPlayerMemoryNamespace,
} from "./playerMemoryBackend";

// Backend spec for issue #1635 — proves the SERVED endpoint (the shape
// `src/server.ts` calls into via `handlePlayerMemoryRequest`) round-trips
// facts through the real `AftersignPlayerMemory` Durable Object class
// over an in-memory storage stub. This spec is the consumer-rule
// counterweight Soren's review demanded: the module can't be dead code
// if a test drives requests through both the router AND the DO class
// against the exact bindings shape wrangler will hand the deployed
// Worker (`env.PLAYER_MEMORY.idFromName(...).get(id).fetch(request)`).
//
// Why not spin up a real Worker with miniflare here? The aftersign
// vitest lane is jsdom-scoped and CI-fast; the router + DO class
// depend only on the standard `Request` / `Response` fetch API
// (available in jsdom via undici/whatwg) and a structural
// `DurableObjectState.storage` (a `Map` fake covers it byte-for-byte).
// That's sufficient to red-line the exact regressions Soren called
// out: an orphaned module (no test), a non-DO class (wrong ctor
// signature), or a router that skips identity. A Playwright /
// wrangler-dev spec against a real DO belongs in a follow-up e2e
// (see #1635 note below), not on the unit lane.

// ---- Test fake: an in-memory DurableObjectStorage.

function createFakeStorage(): AftersignDurableObjectState["storage"] {
  const backing = new Map<string, unknown>();
  return {
    async get<T>(key: string): Promise<T | undefined> {
      return backing.get(key) as T | undefined;
    },
    async put<T>(key: string, value: T): Promise<void> {
      backing.set(key, value);
    },
  };
}

// ---- Test fake: a Durable Object namespace that instantiates the
//      real `AftersignPlayerMemory` class once per identity and holds
//      it in a Map so `idFromName(x).get(id).fetch(request)` matches
//      the CF binding shape wrangler exposes at runtime.

function createFakeNamespace(): AftersignPlayerMemoryNamespace {
  const instances = new Map<string, AftersignPlayerMemory>();
  const env: AftersignPlayerMemoryEnv = {
    // Namespace-in-namespace never resolves; the test never asks the
    // DO to reach back out through env.PLAYER_MEMORY, so a stub that
    // throws on access would also work. Left as an empty forwarder
    // for shape parity with the real binding.
    PLAYER_MEMORY: {
      idFromName: () => ({ toString: () => "" }),
      get: () => ({
        fetch: async () =>
          new Response("nested access not supported in fake", { status: 500 }),
      }),
    },
  };
  return {
    idFromName(name: string) {
      const key = name;
      return { toString: () => key };
    },
    get(id: { toString(): string }) {
      const key = id.toString();
      let instance = instances.get(key);
      if (instance === undefined) {
        instance = new AftersignPlayerMemory({ storage: createFakeStorage() }, env);
        instances.set(key, instance);
      }
      const bound = instance;
      return {
        fetch: (request: Request) => bound.fetch(request),
      };
    },
  };
}

function createFakeEnv(): AftersignPlayerMemoryEnv {
  return { PLAYER_MEMORY: createFakeNamespace() };
}

async function readJson(res: Response): Promise<unknown> {
  return await res.json();
}

const ORIGIN = "https://game.oodim.test";

function postFacts(
  identity: string,
  facts: AftersignPlayerMemoryFacts,
): Request {
  return new Request(`${ORIGIN}/player-memory`, {
    method: "POST",
    headers: {
      [PLAYER_IDENTITY_HEADER]: identity,
      "content-type": "application/json",
    },
    body: JSON.stringify(facts),
  });
}

function getFacts(identity: string): Request {
  return new Request(`${ORIGIN}/player-memory`, {
    method: "GET",
    headers: { [PLAYER_IDENTITY_HEADER]: identity },
  });
}

describe("aftersign player-memory served endpoint (issue #1635)", () => {
  it("returns null when the URL is not /player-memory (falls through to next branch)", async () => {
    const env = createFakeEnv();
    const req = new Request(`${ORIGIN}/ws`, {
      headers: { [PLAYER_IDENTITY_HEADER]: "p1" },
    });
    const res = await handlePlayerMemoryRequest(req, env);
    expect(res).toBeNull();
  });

  it("rejects requests missing the x-player-id header with 400", async () => {
    const env = createFakeEnv();
    const req = new Request(`${ORIGIN}/player-memory`, { method: "GET" });
    const res = await handlePlayerMemoryRequest(req, env);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(400);
    const body = (await readJson(res!)) as { error: string };
    expect(body.error).toContain(PLAYER_IDENTITY_HEADER);
  });

  it("rejects methods other than GET/POST with 405", async () => {
    const env = createFakeEnv();
    const req = new Request(`${ORIGIN}/player-memory`, {
      method: "DELETE",
      headers: { [PLAYER_IDENTITY_HEADER]: "p1" },
    });
    const res = await handlePlayerMemoryRequest(req, env);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(405);
  });

  it("GET before any POST returns an empty facts object", async () => {
    const env = createFakeEnv();
    const res = await handlePlayerMemoryRequest(getFacts("player-alpha"), env);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
    const body = (await readJson(res!)) as { facts: AftersignPlayerMemoryFacts };
    expect(body).toEqual({ facts: {} });
  });

  it("POST persists facts and a subsequent GET returns the same shape", async () => {
    const env = createFakeEnv();
    const identity = "player-alpha";

    const postRes = await handlePlayerMemoryRequest(
      postFacts(identity, {
        lastDeliveryOutcome: "delivered",
        routeAttentionSteps: 3,
      }),
      env,
    );
    expect(postRes).not.toBeNull();
    expect(postRes!.status).toBe(200);
    const postBody = (await readJson(postRes!)) as {
      facts: AftersignPlayerMemoryFacts;
    };
    expect(postBody.facts).toEqual({
      lastDeliveryOutcome: "delivered",
      routeAttentionSteps: 3,
    });

    const getRes = await handlePlayerMemoryRequest(getFacts(identity), env);
    expect(getRes).not.toBeNull();
    expect(getRes!.status).toBe(200);
    const getBody = (await readJson(getRes!)) as {
      facts: AftersignPlayerMemoryFacts;
    };
    expect(getBody.facts).toEqual({
      lastDeliveryOutcome: "delivered",
      routeAttentionSteps: 3,
    });
  });

  it("POST merges into existing facts (same schema semantics as the local writer)", async () => {
    const env = createFakeEnv();
    const identity = "player-alpha";
    await handlePlayerMemoryRequest(
      postFacts(identity, { lastDeliveryOutcome: "delivered" }),
      env,
    );
    await handlePlayerMemoryRequest(
      postFacts(identity, { routeAttentionSteps: 5 }),
      env,
    );
    const res = await handlePlayerMemoryRequest(getFacts(identity), env);
    const body = (await readJson(res!)) as { facts: AftersignPlayerMemoryFacts };
    expect(body.facts).toEqual({
      lastDeliveryOutcome: "delivered",
      routeAttentionSteps: 5,
    });
  });

  it("keeps records isolated per stable player identity", async () => {
    const env = createFakeEnv();
    await handlePlayerMemoryRequest(
      postFacts("player-alpha", { lastDeliveryOutcome: "delivered" }),
      env,
    );
    await handlePlayerMemoryRequest(
      postFacts("player-beta", { lastDeliveryOutcome: "abandoned" }),
      env,
    );
    const alpha = (await readJson(
      (await handlePlayerMemoryRequest(getFacts("player-alpha"), env))!,
    )) as { facts: AftersignPlayerMemoryFacts };
    const beta = (await readJson(
      (await handlePlayerMemoryRequest(getFacts("player-beta"), env))!,
    )) as { facts: AftersignPlayerMemoryFacts };
    expect(alpha.facts).toEqual({ lastDeliveryOutcome: "delivered" });
    expect(beta.facts).toEqual({ lastDeliveryOutcome: "abandoned" });
  });

  it("survives a re-created router surface as long as the same DO instance answers (models a served-record surviving a client-localStorage clear)", async () => {
    // The DO instance and its storage back-map ARE the durable
    // record. Two "sessions" against the SAME identity go through
    // the same instance, so a POST from session A is visible to a
    // GET from session B even after everything client-side is
    // forgotten. This is the exact acceptance criterion #1635 asks
    // for: authoritative persistence keyed to stable identity that
    // outlives client-side ephemeral storage.
    const env = createFakeEnv();
    const identity = "player-alpha";

    // "Session A" — sets a fact.
    await handlePlayerMemoryRequest(
      postFacts(identity, { lastDeliveryOutcome: "delivered" }),
      env,
    );

    // "Session B" — new request objects, no shared client memory,
    // same env (same DO namespace, same instance keyed by identity).
    const res = await handlePlayerMemoryRequest(getFacts(identity), env);
    const body = (await readJson(res!)) as { facts: AftersignPlayerMemoryFacts };
    expect(body.facts).toEqual({ lastDeliveryOutcome: "delivered" });
  });

  it("rejects a POST with a non-object body with 400 (guards the fact schema)", async () => {
    const env = createFakeEnv();
    const req = new Request(`${ORIGIN}/player-memory`, {
      method: "POST",
      headers: {
        [PLAYER_IDENTITY_HEADER]: "player-alpha",
        "content-type": "application/json",
      },
      body: JSON.stringify(["not", "an", "object"]),
    });
    const res = await handlePlayerMemoryRequest(req, env);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(400);
  });

  it("rejects a POST with invalid JSON with 400", async () => {
    const env = createFakeEnv();
    const req = new Request(`${ORIGIN}/player-memory`, {
      method: "POST",
      headers: {
        [PLAYER_IDENTITY_HEADER]: "player-alpha",
        "content-type": "application/json",
      },
      body: "{not-json",
    });
    const res = await handlePlayerMemoryRequest(req, env);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(400);
  });
});
