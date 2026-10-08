import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AftersignAuthoritativeSave,
  handleAuthoritativeSaveRequest,
  MAX_SAVE_BYTES,
  type AftersignAuthoritativeSaveEnv,
} from "./authoritativeSaveBackend";
import {
  AftersignPlayerMemory,
  handlePlayerMemoryRequest,
  MAX_PLAYER_MEMORY_BYTES,
  PLAYER_IDENTITY_HEADER,
  type AftersignPlayerMemoryEnv,
} from "./playerMemoryBackend";
import { isSafeId, readBoundedBody, type WriteRateLimiter } from "./workerRequestGuards";

// Public-traffic hardening for the two unauthenticated AFTERSIGN Worker
// endpoints (`/aftersign/save/:playerId/:slot`, `/player-memory`):
// id/slot shape validation (400), body caps (413), and a per-IP write
// rate limit (429) via the optional AFTERSIGN_WRITE_RATELIMIT binding.
// Requests go through the same binding shape wrangler hands the
// deployed Worker (idFromName → get → fetch) against Map-backed DO
// storage fakes, like the sibling backend specs.

const ORIGIN = "https://game.oodim.test";

function fakeStorage() {
  const backing = new Map<string, unknown>();
  return {
    async get<T>(key: string) {
      return backing.get(key) as T | undefined;
    },
    async put<T>(key: string, value: T) {
      backing.set(key, value);
    },
    async delete(key: string) {
      return backing.delete(key);
    },
  };
}

/** Counts DO dispatches so tests can prove a guard ran BEFORE the DO. */
function saveEnv(limiter?: WriteRateLimiter) {
  const instances = new Map<string, AftersignAuthoritativeSave>();
  const calls = { dispatched: 0 };
  const env: AftersignAuthoritativeSaveEnv = {
    AFTERSIGN_SAVE: {
      idFromName: (name: string) => ({ toString: () => name }),
      get: (id) => {
        const key = id.toString();
        let inst = instances.get(key);
        if (!inst) {
          inst = new AftersignAuthoritativeSave({ storage: fakeStorage() }, env);
          instances.set(key, inst);
        }
        const bound = inst;
        return {
          fetch: (req: Request) => {
            calls.dispatched += 1;
            return bound.fetch(req);
          },
        };
      },
    },
    AFTERSIGN_WRITE_RATELIMIT: limiter,
  };
  return { env, calls };
}

function memoryEnv(limiter?: WriteRateLimiter) {
  const instances = new Map<string, AftersignPlayerMemory>();
  const calls = { dispatched: 0 };
  const env: AftersignPlayerMemoryEnv = {
    PLAYER_MEMORY: {
      idFromName: (name: string) => ({ toString: () => name }),
      get: (id) => {
        const key = id.toString();
        let inst = instances.get(key);
        if (!inst) {
          inst = new AftersignPlayerMemory({ storage: fakeStorage() }, env);
          instances.set(key, inst);
        }
        const bound = inst;
        return {
          fetch: (req: Request) => {
            calls.dispatched += 1;
            return bound.fetch(req);
          },
        };
      },
    },
    AFTERSIGN_WRITE_RATELIMIT: limiter,
  };
  return { env, calls };
}

/** Deterministic limiter: allows `allow` calls per key, records keys. */
function countingLimiter(allow: number) {
  const seen = new Map<string, number>();
  const keys: string[] = [];
  const limiter: WriteRateLimiter = {
    async limit({ key }) {
      keys.push(key);
      const n = (seen.get(key) ?? 0) + 1;
      seen.set(key, n);
      return { success: n <= allow };
    },
  };
  return { limiter, keys };
}

function put(path: string, payload: unknown, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}${path}`, {
    method: "PUT",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ payload }),
  });
}

function postMemory(identity: string, facts: unknown, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}/player-memory`, {
    method: "POST",
    headers: { [PLAYER_IDENTITY_HEADER]: identity, "content-type": "application/json", ...headers },
    body: JSON.stringify(facts),
  });
}

describe("isSafeId", () => {
  it("accepts UUIDs, the legacy test id and smoke ids", () => {
    expect(isSafeId("3f2b8c1e-9a4d-4e7b-8c2a-1d0e5f6a7b8c")).toBe(true);
    expect(isSafeId("local-slice-player")).toBe(true);
    expect(isSafeId("smoke-1234567890-1")).toBe(true);
    expect(isSafeId("a".repeat(64))).toBe(true);
  });

  it("rejects empty, over-long, and out-of-alphabet values", () => {
    for (const bad of ["", "a".repeat(65), "has space", "a/b", "..", "a.b", "ü", "a%2Fb", null, 7]) {
      expect(isSafeId(bad)).toBe(false);
    }
  });
});

describe("/aftersign/save hardening", () => {
  it("400s a playerId or slot outside ^[A-Za-z0-9_-]{1,64}$ before touching the DO", async () => {
    const { env, calls } = saveEnv();
    const bad = [
      "/aftersign/save/has%20space/local",
      "/aftersign/save/player/sl.ot",
      `/aftersign/save/${"a".repeat(65)}/local`,
      "/aftersign/save/a%2Fb/local",
      "/aftersign/save/%E0%A4%A/local",
    ];
    for (const path of bad) {
      const res = await handleAuthoritativeSaveRequest(new Request(`${ORIGIN}${path}`), env);
      expect(res!.status, path).toBe(400);
    }
    expect(calls.dispatched).toBe(0);
  });

  it("round-trips a save under a UUID-shaped capability id", async () => {
    const { env } = saveEnv();
    const path = "/aftersign/save/3f2b8c1e-9a4d-4e7b-8c2a-1d0e5f6a7b8c/local";
    expect((await handleAuthoritativeSaveRequest(put(path, { beat: "x" }), env))!.status).toBe(204);
    const res = await handleAuthoritativeSaveRequest(new Request(`${ORIGIN}${path}`), env);
    expect(res!.status).toBe(200);
    expect(await res!.json()).toEqual({ payload: { beat: "x" }, exists: true });
  });

  it("caps PUT bodies at MAX_SAVE_BYTES (413), accepting a body just under it", async () => {
    const { env, calls } = saveEnv();
    const path = "/aftersign/save/player-a/local";
    const over = await handleAuthoritativeSaveRequest(
      put(path, { blob: "x".repeat(MAX_SAVE_BYTES) }),
      env,
    );
    expect(over!.status).toBe(413);
    expect(calls.dispatched).toBe(0);
    const under = await handleAuthoritativeSaveRequest(
      put(path, { blob: "x".repeat(MAX_SAVE_BYTES - 1024) }),
      env,
    );
    expect(under!.status).toBe(204);
  });

  it("rate-limits PUT and DELETE per client IP (429) but never GET", async () => {
    const { limiter, keys } = countingLimiter(2);
    const { env } = saveEnv(limiter);
    const path = "/aftersign/save/player-a/local";
    const ip = { "CF-Connecting-IP": "203.0.113.7" };
    expect((await handleAuthoritativeSaveRequest(put(path, 1, ip), env))!.status).toBe(204);
    expect((await handleAuthoritativeSaveRequest(put(path, 2, ip), env))!.status).toBe(204);
    const limited = await handleAuthoritativeSaveRequest(
      new Request(`${ORIGIN}${path}`, { method: "DELETE", headers: ip }),
      env,
    );
    expect(limited!.status).toBe(429);
    expect(limited!.headers.get("retry-after")).toBe("60");
    // Reads are not throttled and the third write did not land.
    const read = await handleAuthoritativeSaveRequest(
      new Request(`${ORIGIN}${path}`, { headers: ip }),
      env,
    );
    expect(read!.status).toBe(200);
    expect(await read!.json()).toEqual({ payload: 2, exists: true });
    // A different IP has its own budget.
    const other = await handleAuthoritativeSaveRequest(
      put(path, 3, { "CF-Connecting-IP": "198.51.100.9" }),
      env,
    );
    expect(other!.status).toBe(204);
    expect(keys).toEqual([
      "save:203.0.113.7",
      "save:203.0.113.7",
      "save:203.0.113.7",
      "save:198.51.100.9",
    ]);
  });

  it("fails open when the limiter binding throws (abuse damping, not an auth gate)", async () => {
    const { env } = saveEnv({
      limit: async () => {
        throw new Error("limiter down");
      },
    });
    const res = await handleAuthoritativeSaveRequest(put("/aftersign/save/p/local", 1), env);
    expect(res!.status).toBe(204);
  });
});

describe("/player-memory hardening", () => {
  it("400s an x-player-id outside the accepted alphabet", async () => {
    const { env, calls } = memoryEnv();
    for (const id of ["has space", "a/b", "a".repeat(65), "local.slice"]) {
      const res = await handlePlayerMemoryRequest(
        new Request(`${ORIGIN}/player-memory`, { headers: { [PLAYER_IDENTITY_HEADER]: id } }),
        env,
      );
      expect(res!.status, JSON.stringify(id)).toBe(400);
    }
    expect(calls.dispatched).toBe(0);
  });

  it("caps a single POST body at MAX_PLAYER_MEMORY_BYTES (413)", async () => {
    const { env, calls } = memoryEnv();
    const res = await handlePlayerMemoryRequest(
      postMemory("player-a", { blob: "x".repeat(MAX_PLAYER_MEMORY_BYTES) }),
      env,
    );
    expect(res!.status).toBe(413);
    expect(calls.dispatched).toBe(0);
  });

  it("bounds the MERGED record too, so many small POSTs cannot grow it without limit", async () => {
    const { env } = memoryEnv();
    const chunk = "x".repeat(Math.floor(MAX_PLAYER_MEMORY_BYTES / 3));
    expect((await handlePlayerMemoryRequest(postMemory("player-a", { a: chunk }), env))!.status).toBe(200);
    expect((await handlePlayerMemoryRequest(postMemory("player-a", { b: chunk }), env))!.status).toBe(200);
    const third = await handlePlayerMemoryRequest(postMemory("player-a", { c: chunk, d: chunk }), env);
    expect(third!.status).toBe(413);
    const read = await handlePlayerMemoryRequest(
      new Request(`${ORIGIN}/player-memory`, { headers: { [PLAYER_IDENTITY_HEADER]: "player-a" } }),
      env,
    );
    const body = (await read!.json()) as { facts: Record<string, unknown> };
    expect(Object.keys(body.facts).sort()).toEqual(["a", "b"]);
  });

  it("rate-limits POST per client IP (429) but never GET", async () => {
    const { limiter, keys } = countingLimiter(1);
    const { env } = memoryEnv(limiter);
    const ip = { "CF-Connecting-IP": "203.0.113.7" };
    expect((await handlePlayerMemoryRequest(postMemory("player-a", { a: 1 }, ip), env))!.status).toBe(200);
    expect((await handlePlayerMemoryRequest(postMemory("player-a", { b: 2 }, ip), env))!.status).toBe(429);
    const read = await handlePlayerMemoryRequest(
      new Request(`${ORIGIN}/player-memory`, { headers: { [PLAYER_IDENTITY_HEADER]: "player-a", ...ip } }),
      env,
    );
    expect(read!.status).toBe(200);
    expect(await read!.json()).toEqual({ facts: { a: 1 } });
    expect(keys).toEqual(["player-memory:203.0.113.7", "player-memory:203.0.113.7"]);
  });
});

describe("readBoundedBody", () => {
  it("short-circuits on a declared content-length over the cap", async () => {
    const req = new Request(`${ORIGIN}/x`, {
      method: "POST",
      headers: { "content-length": "999999" },
      body: "small",
    });
    const out = await readBoundedBody(req, 100);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.response.status).toBe(413);
  });

  it("returns the exact text for a body at the cap, counting UTF-8 bytes not chars", async () => {
    const ok = await readBoundedBody(new Request(`${ORIGIN}/x`, { method: "POST", body: "é".repeat(50) }), 100);
    expect(ok).toEqual({ ok: true, text: "é".repeat(50) });
    const over = await readBoundedBody(new Request(`${ORIGIN}/x`, { method: "POST", body: "é".repeat(51) }), 100);
    expect(over.ok).toBe(false);
  });
});

describe("wrangler.jsonc wiring", () => {
  it("declares the AFTERSIGN_WRITE_RATELIMIT [[ratelimits]] binding the routers read", () => {
    const wrangler = readFileSync(
      join(process.cwd(), "wrangler.jsonc"),
      "utf8",
    );
    expect(wrangler).toMatch(/"name":\s*"AFTERSIGN_WRITE_RATELIMIT"/);
    const server = readFileSync(
      join(process.cwd(), "src", "server.ts"),
      "utf8",
    );
    expect(server).toMatch(/AFTERSIGN_WRITE_RATELIMIT\?:/);
  });
});
