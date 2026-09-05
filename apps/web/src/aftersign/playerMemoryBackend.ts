export type AftersignPlayerMemoryFacts = Record<string, unknown>;

export interface AftersignPlayerMemoryNamespace {
  idFromName(name: string): { toString(): string };
  get(id: { toString(): string }): { fetch(request: Request): Promise<Response> };
}

export interface AftersignPlayerMemoryEnv {
  PLAYER_MEMORY: AftersignPlayerMemoryNamespace;
}

interface DurableObjectStorage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

interface DurableObjectState {
  storage: DurableObjectStorage;
}

const FACTS_KEY = "facts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function identityFrom(request: Request): string | null {
  const identity = request.headers.get("x-player-id");
  return identity?.trim() || null;
}

/**
 * Routes a player-memory API request to the durable record for its stable player
 * identity. Deploy this handler from the AFTERSIGN Worker fetch entrypoint.
 */
export async function handlePlayerMemoryRequest(
  request: Request,
  env: AftersignPlayerMemoryEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== "/player-memory") return null;

  const identity = identityFrom(request);
  if (!identity) return json({ error: "x-player-id is required" }, 400);
  if (request.method !== "GET" && request.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  const id = env.PLAYER_MEMORY.idFromName(identity);
  return env.PLAYER_MEMORY.get(id).fetch(request);
}

/** Cloudflare Durable Object: one authoritative memory record per player. */
export class AftersignPlayerMemory {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method === "GET") {
      return json({ facts: (await this.state.storage.get<AftersignPlayerMemoryFacts>(FACTS_KEY)) ?? {} });
    }

    if (request.method === "POST") {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ error: "invalid JSON" }, 400);
      }
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return json({ error: "facts must be an object" }, 400);
      }

      const existing = (await this.state.storage.get<AftersignPlayerMemoryFacts>(FACTS_KEY)) ?? {};
      const facts = { ...existing, ...(body as AftersignPlayerMemoryFacts) };
      await this.state.storage.put(FACTS_KEY, facts);
      return json({ facts });
    }

    return json({ error: "method not allowed" }, 405);
  }
}
