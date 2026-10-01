import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LEGACY_LOCAL_PLAYER_ID,
  PLAYER_ID_STORAGE_KEY,
  resolvePlayerId,
} from "../../../../aftersign/src/playerIdentity.ts";

// Per-visitor identity for AFTERSIGN. Before this, `aftersign/main.js`
// hard-coded `local-slice-player` for every visitor, so once the Worker
// save endpoint persisted (PR #2065) all of game.oodim.com shared ONE
// save. These tests pin the resolution order in
// `aftersign/src/playerIdentity.ts` and that main.js actually uses it.

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
}

const params = (query = "") => new URLSearchParams(query);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("resolvePlayerId", () => {
  it("mints a random UUID on a real host and persists it under the namespaced key", () => {
    const storage = memoryStorage();
    const first = resolvePlayerId({ params: params(), hostname: "game.oodim.com", getStorage: () => storage });
    expect(first.source).toBe("minted");
    expect(first.id).toMatch(UUID);
    expect(storage.data.get(PLAYER_ID_STORAGE_KEY)).toBe(first.id);

    const again = resolvePlayerId({ params: params(), hostname: "game.oodim.com", getStorage: () => storage });
    expect(again).toEqual({ id: first.id, source: "storage" });
  });

  it("gives two different browsers two different ids (no shared save)", () => {
    const a = resolvePlayerId({ params: params(), hostname: "game.oodim.com", getStorage: () => memoryStorage() });
    const b = resolvePlayerId({ params: params(), hostname: "game.oodim.com", getStorage: () => memoryStorage() });
    expect(a.id).not.toBe(b.id);
    expect(a.id).not.toBe(LEGACY_LOCAL_PLAYER_ID);
  });

  it("never hands a real visitor the legacy shared id", () => {
    for (const hostname of ["game.oodim.com", "staging.game.oodim.com", "example.org"]) {
      const out = resolvePlayerId({ params: params(), hostname, getStorage: () => memoryStorage() });
      expect(out.id).not.toBe(LEGACY_LOCAL_PLAYER_ID);
    }
  });

  it("falls back to a session-only id when the storage getter throws", () => {
    const out = resolvePlayerId({
      params: params(),
      hostname: "game.oodim.com",
      getStorage: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    });
    expect(out.source).toBe("memory");
    expect(out.id).toMatch(UUID);
  });

  it("falls back to a session-only id when setItem throws (quota / private mode)", () => {
    const out = resolvePlayerId({
      params: params(),
      hostname: "game.oodim.com",
      getStorage: () => ({
        getItem: () => null,
        setItem: () => {
          throw new DOMException("full", "QuotaExceededError");
        },
      }),
    });
    expect(out.source).toBe("memory");
    expect(out.id).toMatch(UUID);
  });

  it("re-mints when the stored value is malformed (never trusts arbitrary storage)", () => {
    const storage = memoryStorage({ [PLAYER_ID_STORAGE_KEY]: "../../etc" });
    const out = resolvePlayerId({ params: params(), hostname: "game.oodim.com", getStorage: () => storage });
    expect(out.source).toBe("minted");
    expect(out.id).toMatch(UUID);
  });

  it("keeps the legacy fixed id on local dev/test hosts (e2e addresses saves by it)", () => {
    for (const hostname of ["localhost", "127.0.0.1", "::1"]) {
      const storage = memoryStorage();
      const out = resolvePlayerId({ params: params(), hostname, getStorage: () => storage });
      expect(out).toEqual({ id: LEGACY_LOCAL_PLAYER_ID, source: "local-dev" });
      expect(storage.data.size).toBe(0);
    }
  });

  it("?identity=visitor forces the real-visitor path on a local host", () => {
    const out = resolvePlayerId({
      params: params("identity=visitor"),
      hostname: "localhost",
      getStorage: () => memoryStorage(),
    });
    expect(out.source).toBe("minted");
    expect(out.id).toMatch(UUID);
  });

  it("?player=<id> is an explicit override everywhere, and is not persisted", () => {
    const storage = memoryStorage();
    const out = resolvePlayerId({
      params: params("player=smoke-123"),
      hostname: "game.oodim.com",
      getStorage: () => storage,
    });
    expect(out).toEqual({ id: "smoke-123", source: "param" });
    expect(storage.data.size).toBe(0);
  });

  it("ignores a malformed ?player= override", () => {
    const out = resolvePlayerId({
      params: params("player=bad%20id"),
      hostname: "game.oodim.com",
      getStorage: () => memoryStorage(),
    });
    expect(out.source).toBe("minted");
  });

  it("rejects a minted id with an unsafe shape instead of using it", () => {
    expect(() =>
      resolvePlayerId({
        params: params(),
        hostname: "game.oodim.com",
        getStorage: () => memoryStorage(),
        mintId: () => "not a safe id",
      }),
    ).toThrow(/invalid shape/);
  });
});

describe("aftersign/main.js wiring", () => {
  it("boots player.id from resolvePlayerId, not a hard-coded shared id", () => {
    const main = readFileSync(
      join(process.cwd(), "aftersign", "main.js"),
      "utf8",
    );
    expect(main).toMatch(/import \{ resolvePlayerId \} from "\.\/src\/playerIdentity\.ts";/);
    expect(main).toMatch(/const bootstrapPlayerId = resolvePlayerId\(/);
    expect(main).not.toMatch(/id:\s*"local-slice-player"/);
    expect(main).not.toMatch(/bootstrapPlayerId\s*=\s*"local-slice-player"/);
  });
});
