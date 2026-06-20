// agar — slice 2/4 (Durable Object websocket echo).
//
// The smallest possible "the websocket actually works in CI" proof:
// a Worker that upgrades any GET request with `Upgrade: websocket` and
// hands the server end of the pair to a Durable Object (`EchoRoom`).
// The DO holds a single in-memory `seq` counter, increments on every
// inbound message, and echoes `{type:"pong", seq, t}` back to the
// sender only. No multi-client logic, no gameplay state, no persistence
// — those land in slices 3 (20Hz tick) and 4 (two-client convergence).
//
// One DO instance handles all connections in this slice; the id is a
// fixed name ("echo") so every client lands on the same instance. That
// keeps the seq counter visible to the e2e (which only opens one
// client anyway) and matches the spec: "seq is per-DO-instance".

export interface Env {
  ECHO_ROOM: DurableObjectNamespace;
}

// Minimal shape of the inbound ping the client sends every 250ms.
interface PingMessage {
  type: "ping";
  t: number;
}

function isPingMessage(value: unknown): value is PingMessage {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.type === "ping" && typeof v.t === "number";
}

export class EchoRoom implements DurableObject {
  // Monotonic counter per-DO-instance. Starts at 1 on first message in,
  // resets on DO restart (acceptable — no persistence this slice).
  private seq = 0;

  constructor(
    _state: DurableObjectState,
    _env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected websocket upgrade", { status: 426 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    server.accept();

    server.addEventListener("message", (event: MessageEvent) => {
      // Every inbound message advances seq, regardless of payload validity
      // — the counter measures round-trips, not well-formedness. But we
      // only echo back if the payload parsed as a ping (so the client
      // sees a pong with a usable `t` to compute rtt).
      this.seq += 1;
      const seq = this.seq;

      let parsed: unknown;
      try {
        parsed =
          typeof event.data === "string" ? JSON.parse(event.data) : null;
      } catch {
        parsed = null;
      }

      if (!isPingMessage(parsed)) return;

      const pong = JSON.stringify({ type: "pong", seq, t: parsed.t });
      try {
        server.send(pong);
      } catch {
        // Socket closed mid-handler — nothing to do; client will reconnect.
      }
    });

    server.addEventListener("close", () => {
      // No-op. The DO outlives the connection; seq persists in-memory until
      // the DO instance is evicted.
    });

    return new Response(null, { status: 101, webSocket: client });
  }
}

const worker: ExportedHandler<Env> = {
  async fetch(request, env) {
    const url = new URL(request.url);

    // GET / is a deliberate health endpoint. Playwright's webServer probe
    // waits for ANY HTTP response on the configured url, but in practice
    // a 200 is more robust across versions/probers than a 404 — and round
    // 7 of CI-red said "verify the bind actually answers", which a 404
    // can't unambiguously do (the prober can't tell "bound but routed
    // nowhere" from "ip mismatch"). 200 means: TCP up, listener up,
    // module compiled, request loop running.
    if (url.pathname === "/") {
      return new Response("agar echo worker: ok", {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    // Single fixed room — slice 2 has no multi-room logic. The path is
    // just a sanity guard so unrelated requests get a clear 404.
    if (url.pathname !== "/ws") {
      return new Response("Not found", { status: 404 });
    }

    const id = env.ECHO_ROOM.idFromName("echo");
    const stub = env.ECHO_ROOM.get(id);
    return stub.fetch(request);
  },
};

export default worker;
