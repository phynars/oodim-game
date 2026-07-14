import { defineConfig, type PreviewServer, type ViteDevServer } from "vite";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";

// AFTERSIGN — the flagship's first playable vertical slice (Io remembers the
// blue packet outcome across sessions). Self-contained product like the other
// four: its own root, its own base path, its own dist. Ships under
// https://game.oodim.com/aftersign/; the deploy workflow auto-derives the
// stage from dist-aftersign/ once vite build emits it.
//
// Why this file exists (2026-07-05): the product-wiring guard keys off
// `<name>/vite.config.ts` — without it, aftersign is invisible to CI and any
// harness spec under aftersign/e2e/ gates nothing. Test that never runs =
// test that says green forever. See scripts/check-product-wiring.mjs.
//
// `root` is pinned to this directory (not cwd) so the build works when run as
// `vite build --config aftersign/vite.config.ts` from the repo root.
const root = fileURLToPath(new URL(".", import.meta.url));

// -----------------------------------------------------------------------------
// Server-authoritative save endpoint.
//
// The durable-save contract (docs/flagship/story-state-contract.md) requires
// state to survive a local-browser wipe — window.localStorage.clear(), Site
// Data → Delete, incognito, etc. IndexedDB is a DIFFERENT browser bucket, but
// still browser-local: clearing site data wipes it too. So a client-only
// "durable" store is a contract lie — stamping `authority: 'server'` on it
// mis-represents where the payload actually lives.
//
// This middleware exposes a genuine out-of-browser store, keyed by
// `${playerId}::${slot}`. The Map lives in the vite Node process, so:
//   - it outlives page.goto reloads (Playwright cold restart),
//   - it outlives localStorage.clear() (different origin bucket entirely),
//   - it outlives `forceReload({ clearLocalState: true })`,
//   - it is genuinely unreachable via browser DevTools / clear-site-data.
//
// In prod the same client (aftersign/server-authoritative-save.js) can point
// at a Worker-backed endpoint with the same shape (GET/PUT/DELETE
// /aftersign/save/:playerId/:slot). Swapping the storage backend does not
// require touching the game code — the contract is the HTTP shape, not the
// implementation. For the flagship vertical slice the Node-process Map is
// sufficient to prove the invariant: memory loaded from the authoritative
// path is not reconstructed from local browser state.
//
// Registered on BOTH `configureServer` (vite dev, port 5374) and
// `configurePreviewServer` (vite preview, port 4374 — the Playwright lane).
// Same Map instance, so a dev-server hot-reload while a preview is running
// would not confuse them because they run in different Node processes; each
// process has its own store per boot, which is the right granularity for a
// harness that resets slots per test via a Date.now() suffix.
// -----------------------------------------------------------------------------

type SavePayload = unknown;
const authoritativeSaveStore = new Map<string, SavePayload>();

function parseSaveKey(url: string | undefined): { playerId: string; slot: string } | null {
  if (!url) return null;
  // Strip query string and normalize. Path shape: /aftersign/save/:playerId/:slot
  const [pathPart] = url.split("?");
  const match = /^\/aftersign\/save\/([^/]+)\/([^/]+)\/?$/.exec(pathPart);
  if (!match) return null;
  try {
    return {
      playerId: decodeURIComponent(match[1]),
      slot: decodeURIComponent(match[2]),
    };
  } catch {
    return null;
  }
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let buf = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      buf += chunk;
      // Cap at 1 MiB to bound memory — a well-formed slice save is <10 KiB.
      if (buf.length > 1_048_576) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!buf) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(buf));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

function sendEmpty(res: ServerResponse, status: number): void {
  res.statusCode = status;
  res.end();
}

async function handleAuthoritativeSave(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const parsed = parseSaveKey(req.url);
  if (!parsed) return false;
  const key = `${parsed.playerId}::${parsed.slot}`;
  const method = (req.method ?? "GET").toUpperCase();

  if (method === "GET") {
    const payload = authoritativeSaveStore.get(key);
    if (payload === undefined) {
      sendJson(res, 404, { payload: null });
      return true;
    }
    sendJson(res, 200, { payload });
    return true;
  }

  if (method === "PUT" || method === "POST") {
    try {
      const body = (await readJsonBody(req)) as { payload?: SavePayload } | null;
      const nextPayload = body?.payload ?? null;
      authoritativeSaveStore.set(key, nextPayload);
      sendEmpty(res, 204);
    } catch (err) {
      sendJson(res, 400, { error: (err as Error)?.message ?? "bad request" });
    }
    return true;
  }

  if (method === "DELETE") {
    authoritativeSaveStore.delete(key);
    sendEmpty(res, 204);
    return true;
  }

  sendEmpty(res, 405);
  return true;
}

function isSavePath(url: string | undefined): boolean {
  if (!url) return false;
  const [pathPart] = url.split("?");
  return /^\/aftersign\/save\//.test(pathPart);
}

function attachSaveMiddleware(server: ViteDevServer | PreviewServer): void {
  server.middlewares.use((req, res, next) => {
    if (!isSavePath(req.url)) {
      next();
      return;
    }
    handleAuthoritativeSave(req, res).catch((err) => {
      // Surface loudly — a silent 500 would let the game fall through and
      // hide durability regressions behind flaky-looking harness failures.
      // eslint-disable-next-line no-console
      console.error("[aftersign authoritative-save middleware]", err);
      if (!res.headersSent) {
        sendJson(res, 500, { error: (err as Error)?.message ?? "server error" });
      }
    });
  });
}

const authoritativeSavePlugin = {
  name: "aftersign-authoritative-save",
  configureServer(server: ViteDevServer) {
    attachSaveMiddleware(server);
  },
  configurePreviewServer(server: PreviewServer) {
    attachSaveMiddleware(server);
  },
};

export default defineConfig({
  root,
  base: "/aftersign/",
  plugins: [authoritativeSavePlugin],
  build: {
    target: "es2022",
    // Relative to `root` → repo-root/dist-aftersign (separate per-product dist).
    outDir: "../dist-aftersign",
    emptyOutDir: true,
    rollupOptions: {
      // The current index.html imports three.js from esm.sh as absolute URLs
      // — leave them external so Rollup doesn't try to resolve/bundle them.
      // (When the slice's TS scene lands and switches to the `three` npm dep,
      // this line can go.)
      external: (id) => /^https?:\/\//.test(id),
    },
  },
  server: {
    port: 5374,
  },
  preview: {
    port: 4374,
  },
});
