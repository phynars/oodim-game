import { describe, expect, it } from "vitest";
import {
  AftersignAuthoritativeSave,
  handleAuthoritativeSaveRequest,
  type AftersignAuthoritativeSaveEnv,
  type AftersignAuthoritativeSaveNamespace,
  type AftersignAuthoritativeSaveState,
} from "./authoritativeSaveBackend";

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
      return { toString: () => name };
    },
    get(id: { toString(): string }) {
      const key = id.toString();
      let instance = instances.get(key);
      if (instance === undefined) {
        instance = new AftersignAuthoritativeSave({ storage: createFakeStorage() }, env);
        instances.set(key, instance);
      }
      return { fetch: (request: Request) => instance!.fetch(request) };
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

describe("aftersign authoritative-save backend", () => {
  it("returns null when the URL is not /aftersign/save/*", async () => {
    expect(await handleAuthoritativeSaveRequest(new Request(`${ORIGIN}/ws`), createFakeEnv())).toBeNull();
  });

  it("rejects malformed save routes with 400", async () => {
    const res = await handleAuthoritativeSaveRequest(
      new Request(`${ORIGIN}/aftersign/save/only-player`),
      createFakeEnv(),
    );
    expect(res!.status).toBe(400);
  });

  it("rejects methods other than GET/PUT/DELETE with 405", async () => {
    const res = await handleAuthoritativeSaveRequest(
      new Request(`${ORIGIN}/aftersign/save/player-alpha/default`, { method: "PATCH" }),
      createFakeEnv(),
    );
    expect(res!.status).toBe(405);
    expect(res!.headers.get("allow")).toBe("GET, PUT, DELETE");
  });

  it("GET on a cold slot returns a non-error empty-save contract", async () => {
    const res = await handleAuthoritativeSaveRequest(getSave("player-alpha", "default"), createFakeEnv());
    expect(res!.status).toBe(200);
    expect(await readJson(res!)).toEqual({ payload: null, exists: false });
  });

  it("PUT then GET round-trips the payload with exists true", async () => {
    const env = createFakeEnv();
    const payload = { beat: "io-return", revision: 7, note: "π" };
    expect((await handleAuthoritativeSaveRequest(putSave("player-alpha", "default", payload), env))!.status).toBe(204);
    const getRes = await handleAuthoritativeSaveRequest(getSave("player-alpha", "default"), env);
    expect(getRes!.status).toBe(200);
    expect(await readJson(getRes!)).toEqual({ payload, exists: true });
  });

  it("PUT overwrites the previous payload", async () => {
    const env = createFakeEnv();
    await handleAuthoritativeSaveRequest(putSave("player-alpha", "default", { revision: 1 }), env);
    await handleAuthoritativeSaveRequest(putSave("player-alpha", "default", { revision: 2 }), env);
    const getRes = await handleAuthoritativeSaveRequest(getSave("player-alpha", "default"), env);
    expect((await readJson(getRes!)) as { payload: { revision: number } }).toMatchObject({
      payload: { revision: 2 },
      exists: true,
    });
  });

  it("keeps a saved record across separate router requests", async () => {
    const env = createFakeEnv();
    await handleAuthoritativeSaveRequest(
      putSave("player-alpha", "default", { beat: "io-return" }),
      env,
    );
    const getRes = await handleAuthoritativeSaveRequest(
      getSave("player-alpha", "default"),
      env,
    );
    expect(await readJson(getRes!)).toEqual({
      payload: { beat: "io-return" },
      exists: true,
    });
  });

  it("DELETE removes the record; subsequent GET is an empty-save contract", async () => {
    const env = createFakeEnv();
    await handleAuthoritativeSaveRequest(putSave("player-alpha", "default", { revision: 1 }), env);
    expect((await handleAuthoritativeSaveRequest(deleteSave("player-alpha", "default"), env))!.status).toBe(204);
    const getRes = await handleAuthoritativeSaveRequest(getSave("player-alpha", "default"), env);
    expect(getRes!.status).toBe(200);
    expect(await readJson(getRes!)).toEqual({ payload: null, exists: false });
  });

  it("DELETE of an unknown record succeeds", async () => {
    expect((await handleAuthoritativeSaveRequest(deleteSave("player-alpha", "default"), createFakeEnv()))!.status).toBe(204);
  });

  it("keeps records isolated per (playerId, slot) pair", async () => {
    const env = createFakeEnv();
    await handleAuthoritativeSaveRequest(putSave("player-alpha", "default", { who: "alpha-default" }), env);
    await handleAuthoritativeSaveRequest(putSave("player-alpha", "slice-b", { who: "alpha-slice-b" }), env);
    await handleAuthoritativeSaveRequest(putSave("player-beta", "default", { who: "beta-default" }), env);
    for (const [playerId, slot, who] of [
      ["player-alpha", "default", "alpha-default"],
      ["player-alpha", "slice-b", "alpha-slice-b"],
      ["player-beta", "default", "beta-default"],
    ]) {
      const res = await handleAuthoritativeSaveRequest(getSave(playerId, slot), env);
      expect(await readJson(res!)).toEqual({ payload: { who }, exists: true });
    }
  });

  it("rejects invalid JSON with 400", async () => {
    const req = new Request(`${ORIGIN}/aftersign/save/player-alpha/default`, {
      method: "PUT", headers: { "content-type": "application/json" }, body: "{not-json",
    });
    expect((await handleAuthoritativeSaveRequest(req, createFakeEnv()))!.status).toBe(400);
  });

  it("rejects a PUT without a payload field with 400", async () => {
    const req = new Request(`${ORIGIN}/aftersign/save/player-alpha/default`, {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ wrongField: 1 }),
    });
    expect((await handleAuthoritativeSaveRequest(req, createFakeEnv()))!.status).toBe(400);
  });

  it("keeps a stored null payload distinct from a cold slot", async () => {
    const env = createFakeEnv();
    expect((await handleAuthoritativeSaveRequest(putSave("player-alpha", "default", null), env))!.status).toBe(204);
    const getRes = await handleAuthoritativeSaveRequest(getSave("player-alpha", "default"), env);
    expect(await readJson(getRes!)).toEqual({ payload: null, exists: true });
  });

  it("rejects a PUT whose declared content-length exceeds the body cap with 413", async () => {
    const req = new Request(`${ORIGIN}/aftersign/save/player-alpha/default`, {
      method: "PUT",
      headers: { "content-type": "application/json", "content-length": String(2 * 1_048_576) },
      body: JSON.stringify({ payload: { note: "fake" } }),
    });
    expect((await handleAuthoritativeSaveRequest(req, createFakeEnv()))!.status).toBe(413);
  });

  it("rejects a PUT whose realised body exceeds the body cap with 413", async () => {
    const req = new Request(`${ORIGIN}/aftersign/save/player-alpha/default`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload: { blob: "x".repeat(1_200_000) } }),
    });
    expect((await handleAuthoritativeSaveRequest(req, createFakeEnv()))!.status).toBe(413);
  });

  it("URL-decodes route segments before validating them", async () => {
    const env = createFakeEnv();
    expect((await handleAuthoritativeSaveRequest(new Request(`${ORIGIN}/aftersign/save/%41bc/default`, {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ payload: { note: "ok" } }),
    }), env))!.status).toBe(204);
    const getRes = await handleAuthoritativeSaveRequest(getSave("Abc", "default"), env);
    expect(await readJson(getRes!)).toEqual({ payload: { note: "ok" }, exists: true });
  });
});
