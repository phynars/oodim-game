// game.oodim.com Worker entry — agar slice-3+ PROD multiplayer hosting (2026-06-23).
//
// Previously game.oodim.com was an ASSETS-ONLY Worker; agar's multiplayer server
// (the EchoRoom Durable Object — where food/bots/eat-grow run) was DEV-ONLY
// (`wrangler dev` in CI), so prod `/ws` 404'd and the game showed "no one is
// listening" (a lone, dead dot). This entry binds EchoRoom and routes `/ws` to
// it, while serving the static portfolio (pacman/galaga/doom/agar client/landing)
// via env.ASSETS for every other path. Same-origin, one Worker, no client change.
//
// Security (2026-07-09 public-traffic hardening): the /ws upgrade is
// unauthenticated. We now reject cross-origin WS connections here — only the
// game's own pages (game.oodim.com / staging.game.oodim.com) and local dev/
// test origins may open a socket, which blunts drive-by embedding of the
// socket from other sites. An ABSENT Origin passes (non-browser clients,
// wrangler dev), and Origin is client-spoofable — so the REAL throttle is a
// per-IP rate limit on the /ws upgrade via the Workers Rate Limiting binding
// (WS_RATELIMIT, wrangler.jsonc): 20 upgrades / 60s / client IP. That runs in
// code (no WAF-rule slot / no plan upgrade needed) and a spoofed Origin can't
// bypass it. Origin allowlist + rate limit are layered defense-in-depth.
// Routing mirrors agar/server/worker.ts (room keyed by ?seed=).

export { EchoRoom } from "../agar/server/worker";

/** True when a browser-sent Origin is allowed to open the /ws socket. Only a
 *  PRESENT, non-allowed origin is rejected by the caller (absent → allowed). */
export function isAllowedWsOrigin(origin: string): boolean {
  try {
    const h = new URL(origin).hostname.toLowerCase();
    return (
      h === "game.oodim.com" ||
      h === "staging.game.oodim.com" ||
      h === "localhost" ||
      h === "127.0.0.1"
    );
  } catch {
    return false;
  }
}

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  ECHO_ROOM: {
    idFromName: (name: string) => unknown;
    get: (id: unknown) => { fetch: (request: Request) => Promise<Response> };
  };
  // Workers Rate Limiting binding (wrangler.jsonc [[ratelimits]]). Best-effort
  // per-key limiter enforced at the edge; a no-op in `wrangler dev`. Optional
  // so a config without it (or local dev) still routes.
  WS_RATELIMIT?: { limit: (opts: { key: string }) => Promise<{ success: boolean }> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/ws") {
      const origin = request.headers.get("Origin");
      if (origin && !isAllowedWsOrigin(origin)) {
        return new Response("forbidden origin", { status: 403 });
      }
      // Per-IP rate limit on the upgrade — caps connection-flood / DO-cost
      // abuse that a spoofed Origin would otherwise sail through. CF-Connecting-IP
      // is set by Cloudflare (trusted). Best-effort; skipped where the binding
      // is absent (local dev).
      if (env.WS_RATELIMIT) {
        const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
        const { success } = await env.WS_RATELIMIT.limit({ key: ip });
        if (!success) {
          return new Response("rate limited", { status: 429 });
        }
      }
      const seed = url.searchParams.get("seed") ?? "1";
      const id = env.ECHO_ROOM.idFromName(`match:${seed}`);
      return env.ECHO_ROOM.get(id).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};
