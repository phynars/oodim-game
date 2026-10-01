// Durable Object backend for AFTERSIGN's authoritative full-snapshot saves.
// Each Durable Object instance represents one encoded player/slot pair; the
// Worker router selects that instance with AFTERSIGN_SAVE.idFromName().

const SNAPSHOT_KEY = "snapshot";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export class AftersignAuthoritativeSave {
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    try {
      switch (request.method) {
        case "GET": {
          const payload = await this.state.storage.get(SNAPSHOT_KEY);
          return payload === undefined
            ? json({ error: "Save slot not found" }, 404)
            : json({ payload });
        }

        case "PUT": {
          let body: { payload?: unknown };
          try {
            body = await request.json();
          } catch {
            return json({ error: "Invalid save payload" }, 400);
          }
          if (!("payload" in body)) {
            return json({ error: "Missing save payload" }, 400);
          }
          await this.state.storage.put(SNAPSHOT_KEY, body.payload);
          return new Response(null, { status: 204 });
        }

        case "DELETE":
          await this.state.storage.delete(SNAPSHOT_KEY);
          return new Response(null, { status: 204 });

        default:
          return json({ error: "Method not allowed" }, 405);
      }
    } catch (error) {
      console.error("Aftersign authoritative save storage failure", error);
      return json({ error: "Save storage temporarily unavailable" }, 503);
    }
  }
}
