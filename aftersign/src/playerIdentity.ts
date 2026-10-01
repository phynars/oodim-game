// AFTERSIGN per-visitor player identity.
//
// Before this module, `aftersign/main.js` hard-coded
// `playerId = "local-slice-player"` for EVERY visitor. Once the Worker
// save endpoint started persisting (PR #2065), that meant every real
// player on game.oodim.com read and overwrote one shared save at
// `/aftersign/save/local-slice-player/local`.
//
// The fix: each browser mints an unguessable id on first visit
// (`crypto.randomUUID()`), keeps it in localStorage under a namespaced
// key, and uses it as the save's capability token — knowing the id is
// what grants access to the save, so it must never be guessable or
// shared. If storage is unavailable (private mode, blocked site data,
// a throwing accessor) the id lives in memory for the session only.
//
// Resolution order (first match wins):
//   1. `?player=<id>` — explicit override (test hook / support). Must
//      match PLAYER_ID_PATTERN, otherwise ignored. Never persisted.
//   2. Local dev/test hosts (localhost, 127.0.0.1, ::1) WITHOUT
//      `?identity=visitor` — the legacy fixed id `local-slice-player`.
//      The e2e suite (vite preview on localhost) addresses saves by
//      that id directly, clears localStorage to prove server authority,
//      and opens fresh browser contexts that must see the same save;
//      none of that may depend on a per-browser random id.
//   3. A previously minted id in localStorage.
//   4. A freshly minted id, persisted to localStorage when possible,
//      otherwise kept in memory for this page session.
//
// `?identity=visitor` forces the real-visitor path (3/4) on local hosts
// so e2e can exercise exactly what a game.oodim.com player gets.

export const PLAYER_ID_STORAGE_KEY = "aftersign:player-id:v1";
export const LEGACY_LOCAL_PLAYER_ID = "local-slice-player";
/** Same shape the Worker router accepts for a save route segment. */
export const PLAYER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export type PlayerIdSource = "param" | "local-dev" | "storage" | "minted" | "memory";

export interface PlayerIdentity {
  id: string;
  source: PlayerIdSource;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface ParamsLike {
  get(name: string): string | null;
}

export interface ResolvePlayerIdOptions {
  params: ParamsLike;
  hostname: string;
  /** Lazily read so a throwing `window.localStorage` getter is caught. */
  getStorage: () => StorageLike | null | undefined;
  /** Injected for tests; defaults to `crypto.randomUUID()`. */
  mintId?: () => string;
}

export function isValidPlayerId(value: unknown): value is string {
  return typeof value === "string" && PLAYER_ID_PATTERN.test(value);
}

function defaultMintId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  if (c && typeof c.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // No CSPRNG at all: refuse to mint a guessable capability token.
  throw new Error("aftersign: no crypto RNG available to mint a player id");
}

export function resolvePlayerId(options: ResolvePlayerIdOptions): PlayerIdentity {
  const { params, hostname, getStorage } = options;
  const mintId = options.mintId ?? defaultMintId;

  const explicit = params.get("player");
  if (isValidPlayerId(explicit)) return { id: explicit, source: "param" };

  const forceVisitor = params.get("identity") === "visitor";
  if (!forceVisitor && LOCAL_HOSTNAMES.has(hostname.toLowerCase())) {
    return { id: LEGACY_LOCAL_PLAYER_ID, source: "local-dev" };
  }

  let storage: StorageLike | null = null;
  try {
    storage = getStorage() ?? null;
    const existing = storage?.getItem(PLAYER_ID_STORAGE_KEY) ?? null;
    if (isValidPlayerId(existing)) return { id: existing, source: "storage" };
  } catch {
    storage = null;
  }

  const id = mintId();
  if (!isValidPlayerId(id)) {
    throw new Error("aftersign: minted player id has an invalid shape");
  }
  if (storage) {
    try {
      storage.setItem(PLAYER_ID_STORAGE_KEY, id);
      return { id, source: "minted" };
    } catch {
      // Quota / blocked storage: fall through to a session-only id.
    }
  }
  return { id, source: "memory" };
}
