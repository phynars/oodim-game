// agar — entry point / mode dispatcher.
//
// Two modes share the index.html + #game canvas:
//
//   • SINGLE-PLAYER (default) — solo.ts. Runs the pure reducer LOCALLY
//     at 20 Hz, no server. This is what a visitor to /agar/ gets so the
//     game is playable out of the box: move (WASD/arrows or pointer),
//     grow by eating food, eat smaller bots, die→respawn to bigger ones.
//
//   • MULTIPLAYER — multiplayer.ts. The original WS-backed,
//     server-authoritative client that renders from EchoRoom Durable
//     Object snapshots. Selected with `?mp=1` (alias `?mode=multiplayer`).
//     The agar multiplayer / persistence / client-surface / tick e2e
//     specs navigate with `?mp=1`, so they keep hitting this path
//     unchanged.
//
// Root cause this split fixes: the DO Worker is dev-only (no deploy
// routing in agar/wrangler.toml; deploy.yml publishes only static
// assets), so on the live site the WS upgrade 404s and the multiplayer
// client never receives a snapshot — "no one is listening", no
// gameplay. Defaulting to local single-player makes /agar/ playable with
// no backend at all (and incidentally makes the prod play-smoke pass,
// since solo populates window.__game.canonical and ticks locally).

import { startSolo } from "./solo";
import { startMultiplayer } from "./multiplayer";

function wantsMultiplayer(): boolean {
  const params = new URL(window.location.href).searchParams;
  if (params.get("mp") === "1") return true;
  if (params.get("mode") === "multiplayer") return true;
  return false;
}

if (wantsMultiplayer()) {
  startMultiplayer();
} else {
  startSolo();
}
