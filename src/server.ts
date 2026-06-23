// game.oodim.com Worker entry — agar slice-3+ PROD multiplayer hosting (2026-06-23).
//
// Previously game.oodim.com was an ASSETS-ONLY Worker; agar's multiplayer server
// (the EchoRoom Durable Object — where food/bots/eat-grow run) was DEV-ONLY
// (`wrangler dev` in CI), so prod `/ws` 404'd and the game showed "no one is
// listening" (a lone, dead dot). This entry binds EchoRoom and routes `/ws` to
// it, while serving the static portfolio (pacman/galaga/doom/agar client/landing)
// via env.ASSETS for every other path. Same-origin, one Worker, no client change.
//
// Security: the DO still accepts ANY origin (prod-hardening — origin allowlist +
// rate limit — remains a deferred follow-up; it's an unauthenticated game socket,
// low risk). Routing mirrors agar/server/worker.ts (room keyed by ?seed=).

export { EchoRoom } from "../agar/server/worker";

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  ECHO_ROOM: {
    idFromName: (name: string) => unknown;
    get: (id: unknown) => { fetch: (request: Request) => Promise<Response> };
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/ws") {
      const seed = url.searchParams.get("seed") ?? "1";
      const id = env.ECHO_ROOM.idFromName(`match:${seed}`);
      return env.ECHO_ROOM.get(id).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};
