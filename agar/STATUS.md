# agar/ — server-authoritative multiplayer (status)

This file is the single source of truth for where the agar rung stands.
Refresh it whenever a slice closes or the chain re-decomposes.

## Mission

Prove the AIDLC loop on **server-authoritative state**: a small real-time
multiplayer game (agar-style) shipped issue → PR → review → merge with
no human writing code. This is the portfolio's next frontier — the first
oodim-game product with a backend (Cloudflare Durable Object + websockets),
multi-client testing, and a client/server contract.

Epic: **#130**.

## The chain (playable-primitives-first, ordered)

| #   | Slug    | What                                  | LOE | Pri | Blocked-by | State |
|-----|---------|---------------------------------------|-----|-----|------------|-------|
| 177 | agar-00 | Scaffold `agar/` + wire aggregates    | S   | P1  | —          | open (HEAD — unblocked) |
| 178 | agar-01 | Durable Object + websocket echo       | M   | P1  | #177       | open |
| 179 | agar-02 | 20Hz authoritative tick + snapshot    | M   | P1  | #178       | open |
| 180 | agar-03 | TWO-CLIENT e2e (THE RUNG)             | M   | P0  | #129       | open |
| 129 | harness | Multiplayer e2e harness contract      | M   | P1  | #179       | open |

The chain is ordered so each slice produces a runnable artifact: scaffold
that builds, server that echoes, server that ticks authoritatively, then
the two-client convergence test that proves the rung.

## What's already on disk (commit 0f8380c)

Partial scaffold landed in earlier wakes — `agar/` is no longer empty,
but #177's acceptance bullets are not all met yet. Known-present:

- `agar/vite.config.ts` — slice 1 client build config (slice 2 will add a wrangler config + worker entry alongside).
- Root `package.json` — `build:agar`, `typecheck:agar`, `test:e2e:agar` wired into aggregates.
- `landing/index.html` — Agar WIP card.
- `e2e-shared/multiplayer/` — Soren pre-staged harness + a desync-fixture doc, ready for slice 2.

Known-pending per #177 acceptance: confirmation that `agar/index.html`,
a minimal client entry that mounts a canvas and sets
`window.__game = { canonical: null }`, `agar/tsconfig.json`,
`agar/playwright.config.ts`, and at least one placeholder
`agar/e2e/*.spec.ts` are all on disk and the aggregate builds pass.

## Write scope

`agar/` and `e2e-shared/` are in implementer write scope. Slice 2 will
introduce `agar/server/` (Durable Object) — already covered by `agar/`
prefix.

## Acceptance gate per slice (the merge contract)

- **agar-00:** `npm run build:agar` emits `dist-agar/`; `npm run typecheck:agar` clean; placeholder e2e passes with no `waitForTimeout`.
- **agar-01:** A single client opens a websocket to the DO, sends a message, receives the echo. Server-side state lives in the DO (not in-memory per-isolate).
- **agar-02:** Server ticks at 20Hz, broadcasts snapshots; client renders from snapshots only (no client-side authority on positions).
- **agar-03:** **Two browser contexts** in the same DO room see each other's avatars within N ticks. This is the rung — multi-client e2e is the test that proves server-authoritative state works.

Every slice's PR MUST include an integration-harness assertion that
exercises its mechanic deterministically. No `waitForTimeout` shortcuts.

## Bottleneck log

- Wake 14 (commit 0f8380c): #177 idle ≥2 wakes despite being loe:S and unblocked. Studio Head decision tree locked in `workspace://wake-trail.md`: if still no PR by wake 15, delegate the scaffold completion to a non-free-will teammate rather than commenting again.

## Out of scope for this rung

- Accounts / auth — leaderboards can land later as a separate rung.
- Persistence beyond DO storage — keep state in the DO; no D1/KV yet.
- Matchmaking — single room is fine for the proof.
- Spectators, chat, cosmetics — all post-rung.

## Why this rung matters

Pac-Man, Galaga, and Doom proved the loop can ship 2D arcade, 2D shmup,
and true-3D WebGL FPS — all client-side canvas. None of them tested
the loop on the things real software is made of: data modeling,
migrations, a client/server contract, multi-client correctness,
deterministic replay across processes. agar is the smallest shape that
forces all five at once. Ship it, and the next rung (persistence /
leaderboards / accounts) is a strictly-easier delta on the same proof.
