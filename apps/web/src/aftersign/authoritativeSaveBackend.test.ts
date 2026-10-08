import { describe, expect, it } from "vitest";
import {
  AftersignAuthoritativeSave,
  handleAuthoritativeSaveRequest,
  type AftersignAuthoritativeSaveEnv,
  type AftersignAuthoritativeSaveNamespace,
  type AftersignAuthoritativeSaveState,
} from "./authoritativeSaveBackend";

// Backend spec for PR #2065 re-review (AI008 — unverified runtime
// premise). The first draft of the Worker-side save handler kept
// writes in a module-level `new Map()`, which cannot survive
// Workers isolate recycle/eviction and so cannot honor the
// "authority: server" stamp on durable saves. This file replaces
// that premise with a Durable Object (`AftersignAuthoritativeSave`)
// and this test drives requests through the exact binding shape
// wrangler will hand the deployed Worker
// (`env.AFTERSIGN_SAVE.idFromName(...).get(id).fetch(request)`), so
// a regression to a non-DO store, a dropped `env` parameter, or a
// router that skips validation reds here.
//
// Why not spin up a real Worker with miniflare? Same answer as
// `playerMemoryBackend.test.ts` — the router + DO class depend only
// on the standard `Request`/`Response` fetch API (jsdom via
// undici/whatwg) and a structural `DurableObjectState.storage`
// (a `Map` fake covers it byte-for-byte).
//
// PR #2229 (#2227) switched the cold-slot GET from 404 to a 200
// empty-save envelope `{ payload: null, exists: false }`. A stored
// `null` payload stays distinguishable via `exists: true` — the
// invariant the "accepts a null payload" test below pins.

function createFakeStorage(): AftersignAuthoritativeSaveState["storage"] {
  const backing = new Map<string, unknown>();
  return {
    async get<T>(key: string): Promise<T | undefined> {
      return backing.get(key) as T | undefined;
    },
    async put<T>(key: string, value: T): Promise<void> {
      backing.set(key, value);
    },
    async delete(key: string): Promise<boolean> {
      return backing.delete(key);
    },
  };
}

function createFakeNamespace(): AftersignAuthoritativeSaveNamespace {
  const instances = new Map<string, AftersignAuthoritativeSave>();
  // Nested-access stub for shape parity with the real binding; this
  // test never asks the DO to reach back out through
  // env.AFTERSIGN_SAVE.
  const env: AftersignAuthoritativeSaveEnv = {
    AFTERSIGN_SAVE: {
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
        instance = new AftersignAuthoritativeSave(
          { storage: createFakeStorage() },
          env,
        );
        instances.set(key, instance);
      }
      const bound = instance;
      return { fetch: (request: Request) => bound.fetch(request) };
    },
  };
}

function createFakeEnv(): AftersignAuthoritativeSaveEnv {
  return { AFTERSIGN_SAVE: createFakeNamespace() };
}

const ORIGIN = "https://game.oodim.test";

function getSave(playerId: string, slot: string): Request {
  return new Request(
    `${ORIGIN}/aftersign/save/${encodeURIComponent(playerId)}/${encodeURIComponent(slot)}`,
    { method: "GET" },
  );
}

function putSave(playerId: string, slot: string, payload: unknown): Request {
  return new Request(
    `${ORIGIN}/aftersign/save/${encodeURIComponent(playerId)}/${encodeURIComponent(slot)}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload }),
    },
  );
}

function deleteSave(playerId: string, slot: string): Request {
  return new Request(
    `${ORIGIN}/aftersign/save/${encodeURIComponent(playerId)}/${encodeURIComponent(slot)}`,
    { method: "DELETE" },
  );
}

async function readJson(res: Response): Promise<unknown> {
  return await res.json();
}

describe("aftersign authoritative-save backend (PR #2065 re-review)", () => {
  it("returns null when the URL is not /aftersign/save/* (falls through to next branch)", async () => {
    const env = createFakeEnv();
    const req = new Request(`${ORIGIN}/ws`, { method: "GET" });
    const res = await handleAuthoritativeSaveRequest(req, env);
    expect(res).toBeNull();
  });

  it("rejects malformed save routes with 400", async () => {
    const env = createFakeEnv();
    // Missing slot segment.
    const req = new Request(`${ORIGIN}/aftersign/save/only-player`, { method: "GET" });
    const res = await handleAuthoritativeSaveRequest(req, env);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(400);
  });

  it("rejects methods other than GET/PUT/DELETE with 405", async () => {
    const env = createFakeEnv();
    const req = new Request(`${ORIGIN}/aftersign/save/player-alpha/default`, {
      method: "PATCH",
    });
    const res = await handleAuthoritativeSaveRequest(req, env);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(405);
    expect(res!.headers.get("allow")).toBe("GET, PUT, DELETE");
  });

  it("GET on a cold slot returns 200 { payload: null, exists: false } (#2227)", async () => {
    const env = createFakeEnv();
    const res = await handleAuthoritativeSaveRequest(
      getSave("player-alpha", "default"),
      env,
    );
    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
    expect(await readJson(res!)).toEqual({ payload: null, exists: false });
  });

  it("PUT then GET round-trips the payload (durable write-read)", async () => {
    const env = createFakeEnv();
    const payload = { beat: "io-return", revision: 7, note: "π" };

    const putRes = await handleAuthoritativeSaveRequest(
      putSave("player-alpha", "default", payload),
      env,
    );
    expect(putRes).not.toBeNull();
    expect(putRes!.status).toBe(204);

    const getRes = await handleAuthoritativeSaveRequest(
      getSave("player-alpha", "default"),
      env,
    );
    expect(getRes).not.toBeNull();
    expect(getRes!.status).toBe(200);
    const body = (await readJson(getRes!)) as { payload: unknown; exists: boolean };
    expect(body.payload).toEqual(payload);
    expect(body.exists).toBe(true);
  });

  it("PUT overwrites the previous payload (single-writer semantics)", async () => {
    const env = createFakeEnv();
    await handleAuthoritativeSaveRequest(
      putSave("player-alpha", "default", { revision: 1 }),
      env,
    );
    await handleAuthoritativeSaveRequest(
      putSave("player-alpha", "default", { revision: 2 }),
      env,
    );
    const getRes = await handleAuthoritativeSaveRequest(
      getSave("player-alpha", "default"),
      env,
    );
    const body = (await readJson(getRes!)) as { payload: { revision: number } };
    expect(body.payload.revision).toBe(2);
  });

  it("DELETE removes the record; subsequent GET is cold (#2227: 200 { payload: null, exists: false })", async () => {
    const env = createFakeEnv();
    await handleAuthoritativeSaveRequest(
      putSave("player-alpha", "default", { revision: 1 }),
      env,
    );
    const delRes = await handleAuthoritativeSaveRequest(
      deleteSave("player-alpha", "default"),
      env,
    );
    expect(delRes!.status).toBe(204);
    const getRes = await handleAuthoritativeSaveRequest(
      getSave("player-alpha", "default"),
      env,
    );
    expect(getRes!.status).toBe(200);
    expect(await readJson(getRes!)).toEqual({ payload: null, exists: false });
  });

  it("DELETE of an unknown record succeeds (idempotent no-op)", async () => {
    const env = createFakeEnv();
    const delRes = await handleAuthoritativeSaveRequest(
      deleteSave("player-alpha", "default"),
      env,
    );
    expect(delRes!.status).toBe(204);
  });

  it("keeps records isolated per (playerId, slot) pair (no cross-talk)", async () => {
    const env = createFakeEnv();
    await handleAuthoritativeSaveRequest(
      putSave("player-alpha", "default", { who: "alpha-default" }),
      env,
    );
    await handleAuthoritativeSaveRequest(
      putSave("player-alpha", "slice-b", { who: "alpha-slice-b" }),
      env,
    );
    await handleAuthoritativeSaveRequest(
      putSave("player-beta", "default", { who: "beta-default" }),
      env,
    );

    const alphaDefault = (await readJson(
      (await handleAuthoritativeSaveRequest(
        getSave("player-alpha", "default"),
        env,
      ))!,
    )) as { payload: { who: string } };
    const alphaSliceB = (await readJson(
      (await handleAuthoritativeSaveRequest(
        getSave("player-alpha", "slice-b"),
        env,
      ))!,
    )) as { payload: { who: string } };
    const betaDefault = (await readJson(
      (await handleAuthoritativeSaveRequest(
        getSave("player-beta", "default"),
        env,
      ))!,
    )) as { payload: { who: string } };

    expect(alphaDefault.payload.who).toBe("alpha-default");
    expect(alphaSliceB.payload.who).toBe("alpha-slice-b");
    expect(betaDefault.payload.who).toBe("beta-default");
  });

  it("survives repeated router entries against the same (playerId, slot) — the DO storage is the durable record (models an isolate recycle between PUT and GET)", async () => {
    // The DO instance Map in the fake is keyed by idFromName; the
    // same key always resolves to the same instance (same storage
    // back-map). This is the exact substrate shape Cloudflare
    // guarantees in prod: isolate recycle between requests cannot
    // drop the record because the record lives in `state.storage`,
    // not in isolate memory. A regression that re-introduces a
    // module-level Map would still pass THIS test only by accident
    // (same JS realm), but the shape (one DO per (playerId, slot),
    // storage via state.storage) is pinned by every other test in
    // this file — a Map on the router would not key by
    // idFromName and would fail the cross-talk test above.
    const env = createFakeEnv();
    const identity: [string, string] = ["player-alpha", "default"];

    await handleAuthoritativeSaveRequest(
      putSave(identity[0], identity[1], { beat: "io-return" }),
      env,
    );

    // New Request objects, no shared router memory, same env (same
    // DO namespace, same instance keyed by `${playerId}::${slot}`).
    const getRes = await handleAuthoritativeSaveRequest(
      getSave(identity[0], identity[1]),
      env,
    );
    const body = (await readJson(getRes!)) as { payload: { beat: string } };
    expect(body.payload.beat).toBe("io-return");
  });

  it("rejects a PUT with invalid JSON with 400", async () => {
    const env = createFakeEnv();
    const req = new Request(`${ORIGIN}/aftersign/save/player-alpha/default`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    });
    const res = await handleAuthoritativeSaveRequest(req, env);
    expect(res!.status).toBe(400);
  });

  it("rejects a PUT whose body is not an object with a payload field with 400", async () => {
    const env = createFakeEnv();
    const req = new Request(`${ORIGIN}/aftersign/save/player-alpha/default`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wrongField: 1 }),
    });
    const res = await handleAuthoritativeSaveRequest(req, env);
    expect(res!.status).toBe(400);
  });

  it("accepts a null payload (clears to null, stays distinct from a cold slot via exists:true — #2227)", async () => {
    const env = createFakeEnv();
    const req = new Request(`${ORIGIN}/aftersign/save/player-alpha/default`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload: null }),
    });
    const putRes = await handleAuthoritativeSaveRequest(req, env);
    expect(putRes!.status).toBe(204);

    const getRes = await handleAuthoritativeSaveRequest(
      getSave("player-alpha", "default"),
      env,
    );
    expect(getRes!.status).toBe(200);
    // Both fields matter: payload is null (what the client wrote) AND
    // exists is true (so the client can distinguish "we stored null"
    // from "nothing has been stored").
    expect(await readJson(getRes!)).toEqual({ payload: null, exists: true });
  });

  it("rejects a PUT whose declared content-length exceeds the body cap with 413", async () => {
    const env = createFakeEnv();
    const req = new Request(`${ORIGIN}/aftersign/save/player-alpha/default`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "content-length": String(2 * 1_048_576),
      },
      body: JSON.stringify({ payload: { note: "fake" } }),
    });
    const res = await handleAuthoritativeSaveRequest(req, env);
    expect(res!.status).toBe(413);
  });

  it("rejects a PUT whose realised body exceeds the body cap with 413 (content-length is advisory)", async () => {
    const env = createFakeEnv();
    // Build a body over the cap by padding a string field. We don't send a
    // content-length header so only the realised-length check can
    // catch this — exactly the attack a mendacious client would try.
    const bigString = "x".repeat(1_200_000);
    const req = new Request(`${ORIGIN}/aftersign/save/player-alpha/default`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload: { blob: bigString } }),
    });
    const res = await handleAuthoritativeSaveRequest(req, env);
    expect(res!.status).toBe(413);
  });

  it("URL-decodes route segments before validating them (a percent-encoded safe id round-trips)", async () => {
    const env = createFakeEnv();
    // `%41bc` decodes to `Abc`, which is inside the accepted alphabet.
    const put = new Request(`${ORIGIN}/aftersign/save/%41bc/default`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload: { note: "ok" } }),
    });
    expect((await handleAuthoritativeSaveRequest(put, env))!.status).toBe(204);
    const getRes = await handleAuthoritativeSaveRequest(getSave("Abc", "default"), env);
    expect(getRes!.status).toBe(200);
    const body = (await readJson(getRes!)) as { payload: { note: string } };
    expect(body.payload.note).toBe("ok");
  });
});
