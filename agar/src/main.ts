// agar — slice 2/4 (Durable Object websocket echo, client side).
//
// Connects ONE WebSocket to the agar Worker on page load, sends
// `{type:"ping", t: <client-ts>}` every 250ms, and renders the latest
// `seq` and `rtt` (in ms) on the canvas. No gameplay yet — this slice
// only proves the round-trip lands inside the CI merge gate.
//
// The WS URL is derived from window.location so both `wrangler dev`
// (default port 8787) and a future prod origin work without code change.
// In dev/preview the page is served from a different port than the Worker,
// so we point explicitly at port 8787 when running on localhost.

const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("agar: #game canvas not found");
}

const ctx = canvas.getContext("2d");
if (!ctx) {
  throw new Error("agar: 2d context unavailable");
}

interface PongMessage {
  type: "pong";
  seq: number;
  t: number;
}

function isPongMessage(value: unknown): value is PongMessage {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.type === "pong" && typeof v.seq === "number" && typeof v.t === "number"
  );
}

function wsUrl(): string {
  const loc = window.location;
  const proto = loc.protocol === "https:" ? "wss:" : "ws:";
  // In dev/preview (vite serves agar at :4274), the DO Worker runs on
  // :8787 via `wrangler dev`. In prod the Worker is exposed under the
  // same origin and the path /ws is routed by the platform.
  const host =
    loc.hostname === "localhost" || loc.hostname === "127.0.0.1"
      ? `${loc.hostname}:8787`
      : loc.host;
  return `${proto}//${host}/ws`;
}

// Latest values rendered by the draw loop. Updated on every pong.
let lastSeq = 0;
let lastRtt = 0;
let connected = false;

function draw() {
  if (!ctx) return;
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Placeholder cell — same visual cue as slice 1 so the canvas reads
  // as "intentional placeholder, networking live" rather than blank.
  ctx.fillStyle = "#80e6c1";
  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2 - 40, 36, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#e8eaff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "600 28px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText("Agar", canvas.width / 2, canvas.height / 2 + 40);

  // The two numbers the e2e asserts on. Rendered as a single line so a
  // Playwright text snapshot can match them with one regex.
  ctx.font = "500 14px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillStyle = connected ? "#9090a8" : "#a85050";
  ctx.fillText(
    `seq=${lastSeq}  rtt=${lastRtt}ms`,
    canvas.width / 2,
    canvas.height / 2 + 72,
  );
}

// The e2e reads the seq/rtt off the DOM, not the canvas pixels — canvas
// text isn't queryable. We mirror the same string into a hidden element
// with a data-testid so Playwright can wait on it deterministically.
const probe = document.createElement("div");
probe.setAttribute("data-testid", "agar-net-status");
probe.style.position = "absolute";
probe.style.left = "-9999px";
probe.style.top = "-9999px";
probe.dataset.seq = "0";
probe.dataset.rtt = "0";
probe.dataset.connected = "false";
probe.textContent = "seq=0 rtt=0";
document.body.appendChild(probe);

function syncProbe() {
  probe.dataset.seq = String(lastSeq);
  probe.dataset.rtt = String(lastRtt);
  probe.dataset.connected = String(connected);
  probe.textContent = `seq=${lastSeq} rtt=${lastRtt}`;
}

draw();
syncProbe();

const ws = new WebSocket(wsUrl());

ws.addEventListener("open", () => {
  connected = true;
  syncProbe();
  draw();
});

ws.addEventListener("close", () => {
  connected = false;
  syncProbe();
  draw();
});

ws.addEventListener("message", (event: MessageEvent) => {
  let parsed: unknown;
  try {
    parsed = typeof event.data === "string" ? JSON.parse(event.data) : null;
  } catch {
    return;
  }
  if (!isPongMessage(parsed)) return;
  lastSeq = parsed.seq;
  lastRtt = Math.max(0, Date.now() - parsed.t);
  syncProbe();
  draw();
});

// 250ms ping cadence. Only sends when the socket is OPEN — otherwise we'd
// throw and tear down the interval. If the WS isn't connected yet, skip
// this tick; the next one will try again once `open` fires.
setInterval(() => {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "ping", t: Date.now() }));
}, 250);
