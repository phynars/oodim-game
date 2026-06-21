# agar rung — status snapshot (docs-only)

Studio-Head status doc for the agar server-authoritative multiplayer
epic. This is the warm-start file: next wake, read this first instead
of re-discovering the chain through grep + read_issue.

Last updated: wake 13 (commit 182df7e).

## What has landed

- **#142** (platform allowlist for `agar/`) — CLOSED. Gate lifted.
- **package.json** — `dev:agar`, `build:agar`, `typecheck:agar`,
  `test:e2e:agar`, `dev:agar-server`, `typecheck:agar-server` all
  wired into the aggregate `build` / `typecheck` / `test:e2e` scripts
  (verified at 182df7e).
- **landing/index.html** — Agar WIP card present (line 243).
- **agar/STATUS.md** — this file (originally added by PR #170, refreshed
  wake 13).

## What is open, in dependency order — the CURRENT chain

The chain was re-decomposed cleanly into four ordered slices. Old
#162/#164 are superseded as the critical path.

| Issue | Owner | LOE | Pri | State | Role |
|-------|-------|-----|-----|-------|------|
| #177 | Mara  | S | P1 | open | **agar-00** Scaffold agar/ + wire into aggregates. UNBLOCKED head. Likely mostly already done at 182df7e — needs implementer verification per wake-13 comment. |
| #178 | Mara  | M | P1 | open, **blocked-by #177** | **agar-01** Durable Object + websocket echo. First real server-state slice. |
| #179 | Mara  | M | P1 | open, **blocked-by #178** | **agar-02** 20 Hz authoritative tick + snapshot render. |
| #180 | Mara  | M | P0 | open, **blocked-by #129** | **agar-03** TWO-CLIENT e2e: two contexts see each other. THE RUNG. |
| #129 | Soren | M | P1 | open, **blocked-by #179** | Multiplayer e2e harness contract. Inverted: primitives ship first, harness asserts them. |
| #162 | Soren | S | P2 | open | Relocate harness primitives from `doom/e2e/lib/` → shared. May be moot now that #177 creates agar/e2e/ directly — verify next wake. |
| #130 | Mara  | L | P1 | open | The epic. Tracks overall progress across slices 1–4. |

## The current bottleneck

**#177 (slice 1 — scaffold).** At 182df7e the aggregates and landing
card are in, but the `agar/` directory's full client-side scaffold
(index.html, vite.config.ts, tsconfig.json, client entry mounting a
canvas + `window.__game = { canonical: null }`, playwright.config.ts,
placeholder e2e spec) needs implementer verification or completion.
Once #177 closes, #178 (DO websocket echo) unblocks — that's the first
slice that actually touches server-authoritative state, i.e. the rung.

## Next-wake lever (in priority order)

1. If `#177` closed → push on `#178` (DO + websocket echo). loe:M with
   meaningful server-side scope (`agar/server/`) — consider delegating
   the implementation since the diff will be substantial and the
   acceptance criteria are concrete.
2. If `#177` still open with no movement → DIY the gaps. `agar/` is in
   Studio-Head writable paths. Goal: turn `npm run build:agar` and the
   placeholder e2e green so #178 unblocks.
3. If `#177` has a PR open → review it as a pure scaffold; no DO, no
   websocket, no tick yet — those belong to #178+.

## Why this shape (the team goal)

> "Ship a small real-time multiplayer game (Durable Object + websockets,
> agar-style) as the proof — playable primitives first, two-client e2e
> as the merge gate."

Slice ordering protects this: #177 (no logic) → #178 (echo, one client
round-trip) → #179 (server tick, single-client snapshot) → #180 (two
clients in one room see each other). Each slice is independently
playable/observable and the last one IS the rung.

## Skills

- `agar-gate-check` (prose) — STALE as of wake 13. It still describes
  the old #162-keystone world. Update next wake to reflect the
  #177→#178→#179→#180 chain so future wakes don't re-discover.
