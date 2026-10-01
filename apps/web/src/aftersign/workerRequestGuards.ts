// Shared request guards for the AFTERSIGN Worker endpoints
// (`/aftersign/save/:playerId/:slot` and `/player-memory`).
//
// Both endpoints are unauthenticated: the player id IS the capability
// token (see `aftersign/src/playerIdentity.ts`). That makes three cheap
// pre-DO guards load-bearing, so they live here and both routers use
// them:
//
//   1. Id/slot shape — `^[A-Za-z0-9_-]{1,64}$`, 400 otherwise. Keeps DO
//      names bounded and rejects path/encoding games outright.
//   2. Per-IP write rate limit — the Workers Rate Limiting binding
//      (`AFTERSIGN_WRITE_RATELIMIT`, wrangler.jsonc [[ratelimits]]),
//      same pattern as `/ws`'s `WS_RATELIMIT` in `src/server.ts`.
//      Optional so local dev / a config without it still routes.
//   3. Body-size cap — enforced on the advisory `content-length` AND on
//      the bytes actually streamed (read incrementally, aborted as soon
//      as the cap is crossed), 413 otherwise.
//
// Type shims only (no `@cloudflare/workers-types`), matching the sibling
// backend modules' tsconfig-lane constraint.

/** Accepted shape for a player id or a save slot route segment. */
export const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function isSafeId(value: unknown): value is string {
  return typeof value === "string" && SAFE_ID_PATTERN.test(value);
}

/** Structural shape of a Workers Rate Limiting binding. */
export interface WriteRateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export function guardJson(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

/**
 * Per-IP write throttle. Returns a 429 Response when the limiter says
 * no, otherwise `null`. A missing binding (local dev) or a limiter that
 * throws fails OPEN — the limiter is abuse damping, not an auth gate,
 * and a limiter outage must not take saves down with it.
 */
export async function rateLimitWrite(
  request: Request,
  limiter: WriteRateLimiter | undefined,
  scope: string,
): Promise<Response | null> {
  if (!limiter) return null;
  // CF-Connecting-IP is set by Cloudflare (trusted, not client-forgeable
  // at the edge).
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  try {
    const { success } = await limiter.limit({ key: `${scope}:${ip}` });
    if (!success) {
      return guardJson({ error: "Too many writes; slow down" }, 429, { "retry-after": "60" });
    }
  } catch {
    return null;
  }
  return null;
}

export type BoundedBody =
  | { ok: true; text: string }
  | { ok: false; response: Response };

/**
 * Read a request body as UTF-8 text, refusing anything over `maxBytes`.
 * Checks the declared `content-length` first (cheap short-circuit), then
 * counts the streamed bytes and cancels the stream the moment the cap is
 * crossed, so an oversized body is never fully buffered.
 */
export async function readBoundedBody(request: Request, maxBytes: number): Promise<BoundedBody> {
  const tooLarge = (): BoundedBody => ({
    ok: false,
    response: guardJson({ error: "Payload too large", maxBytes }, 413),
  });
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const n = Number(declared);
    if (Number.isFinite(n) && n > maxBytes) return tooLarge();
  }
  const body = request.body;
  if (!body) return { ok: true, text: "" };
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return tooLarge();
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, response: guardJson({ error: "Invalid payload" }, 400) };
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(merged) };
}
