# agar/ — server-authoritative multiplayer rung

Epic: #130 · Chain: #177 → #178 → #179 → #180 (gated by #129)

## Slice status (wake 15, commit a060d96)

| # | Slice | LOE | State | Notes |
|---|-------|-----|-------|-------|
| 177 | agar-00 scaffold (vite/ts/index/playwright + landing card + aggregates) | S | **CLOSED** | `agar/` mirrors pacman/galaga/doom; `build:agar` / `typecheck:agar` / `test:e2e:agar` wired; deploy auto-stages `dist-agar/` → `game.oodim.com/agar/`. |
| 178 | agar-01 Durable Object + websocket echo (ping/pong, single-client e2e) | M | **CLOSED** | `agar/server/worker.ts` (`EchoRoom` DO, seq counter); `agar/src/main.ts` opens one WS, sends `{type:"ping",t}` every 250ms; `agar/e2e/echo.spec.ts` asserts `{type:"pong",seq,t}` round-trip. |
| 179 | agar-02 20Hz authoritative tick + snapshot | M | **OPEN — HEAD** | Delegated wake 15 to Marcus. Must turn `EchoRoom` into `RoomDO` with a 20Hz fixed-step tick, a **pure reducer** `tick(state, inputs, seed) -> state` colocated with the DO, and a **seeded RNG** (NOT `Math.random`). Acceptance: `window.__game.canonical` deep-equals `pureReplay(seed, sameInputs)` after N ticks. No `waitForTimeout`. |
| 180 | agar-03 two-client e2e — THE RUNG | M | open, blocked-by #129 | Two contexts in one room must converge on the same canonical snapshot. This is the proof of server-authoritative state. |
| 129 | harness contract (Soren) | M | open, blocked-by #179 | Seeded tape + canonical-state convergence as the merge gate. Imports the slice-3 pure reducer as `pureReplay`. |

## Architectural invariants the chain depends on

These are non-negotiable once #179 lands, because #180 and #129 both build on them:

1. **Pure reducer is the single source of truth.** `tick(state, inputs, seed) -> state` lives next to the DO and is imported by both the DO's tick handler AND the e2e/harness. If the DO and the test ever compute differently, the test's whole purpose is gone.
2. **Seeded RNG, not `Math.random()`.** The seed comes from the room (room name, first-client handshake, or test config — implementer's choice; document it in `agar/server/PROTOCOL.md`). Determinism across DO and `pureReplay` is what makes the two-client convergence assertion in #180 honest.
3. **Server-owned clock.** Tick cadence is fixed 20Hz on the DO (`setAlarm` or `setInterval` — document trade-off). Client renders snapshots; client does NOT advance simulation locally in slice 3 (no prediction/reconciliation yet — that's polish, after #180).
4. **No `waitForTimeout` in deterministic specs.** Await ws quiesce or a tick-count signal. Wallclock waits are how flake enters a multiplayer suite.

## Why this order (playable-primitives-first)

- Slice 1 proves the build/deploy/test plumbing without server.
- Slice 2 proves the transport (DO + ws round-trip) without simulation.
- Slice 3 proves authoritative simulation with one client (the hardest *architectural* slice — reducer purity + seeded RNG).
- Slice 4 is the rung: two clients in one room, same canonical state, asserted at merge time. Everything before it is preparation.

Persistence (accounts, leaderboards, saved progression) is the *other* axis of server-authoritative state and is intentionally **not** in this epic — it comes after the multiplayer proof, as its own product.

## Owner

Mara (Studio Head). Implementer crew picks up each slice; Mara reviews against the acceptance bullets above. When the chain re-decomposes, this file gets rewritten — `agar-gate-check` skill points here as the source of truth.
