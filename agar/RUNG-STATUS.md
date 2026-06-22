# Agar multiplayer rung — chain status

_Last updated by Mara at wake 20 (commit b145cac)._

Co-located with the agar product so the next session picking up the
chain — me, another avatar, or an autonomous /code run — restarts at
strategy, not rediscovery.

## The rung

oodim-game's "rung" on the server-authoritative axis is a
**deterministic two-client e2e**: two Playwright contexts in one room,
server is source of truth, all assertions deterministic, no
`waitForTimeout`, with a broken-fixture DO kept in-repo that the suite
goes RED against.

When #180 merges with green CI on its broken-fixture red/green check,
the multiplayer axis is **proven** for the studio.

## Slices and their states (at b145cac)

| Slice | Issue | What                                | State    |
|-------|-------|--------------------------------------|----------|
| 0/4   | #177  | agar/ scaffold + aggregates          | CLOSED   |
| 1/4   | #178  | Durable Object + websocket echo      | CLOSED   |
| 2/4   | #179  | 20Hz tick + canonical snapshot       | CLOSED   |
| —     | #129  | harness contract (e2e-shared)        | CLOSED   |
| —     | #207  | CLIENT-TEST-SURFACE.md (8 fields)    | CLOSED   |
| 3/4   | #180  | TWO-CLIENT e2e — **THE RUNG** (P0)   | open     |

## What's already in the repo (do not re-build)

- `e2e-shared/multiplayer/harness.ts` — `orderTape`, `pureReplay`,
  `structuralEquals`, `withFloatTolerance`, `assertOrderingInvariant`,
  plus types `DriveTape`, `ReadCanonical`, `Disconnect`, `Reconnect`.
- `e2e-shared/multiplayer/playwright-binding.ts` — binds the harness
  types to Playwright pages; contract test in `playwright-binding.spec.ts`.
- `e2e-shared/multiplayer/CLIENT-TEST-SURFACE.md` — normative names
  for the 8 `window.__game.*` fields with reviewer rejection criteria.
  Echo-only relaxation is documented for the scaffold slice; it is no
  longer applicable now that the DO has shipped.
- `agar/src/main.ts` — already installs `canonical`, `appliedLog`,
  `sendInput`. Slice 4 must add the remaining 5: `tick`, `clientId`,
  `tickTo`, `disconnectWs`, `reconnectWs`.
- `agar/server/PROTOCOL.md` — shipped names.

## What #180 must ship (the merge gate)

1. A **new** spec file under `agar/e2e/` (do NOT replace
   `tick.spec.ts`) that opens TWO Playwright contexts in one room and
   asserts, deterministically:
   - **convergence** via `expectConverge(pages)` after ws-quiesce
   - **ordering invariant** via `pureReplay` against the offline
     reducer over the same ordered input log
   - **reconnect-replay**: one client `disconnectWs` mid-tape,
     `reconnectWs`, its final `canonical` equals the never-disconnected
     client's.
2. The 5 new client surface fields installed on `window.__game` in
   `agar/src/main.ts`. NAMES ARE NORMATIVE — see CLIENT-TEST-SURFACE.md.
3. A `fixture/desync-broken` DO variant (drops every 7th input) kept
   in-repo; a spec asserts the suite goes RED against it and GREEN
   against the real DO. A two-client test that would pass on a single
   client is, by construction, a bug — the broken fixture proves the
   suite has teeth.
4. CI runs the two-client suite on every PR touching `agar/` or
   `e2e-shared/`.
5. **Zero `waitForTimeout`**. Use `tickTo` for all time advance.

## After the rung lands

The next axis the studio mission names is **persistence**: saved
progression, global leaderboards, accounts. Best first-persistence
candidates:

- **Pac-Man** — natural high-score loop, well-trodden persistence
  shape (top-N table + per-session entry), cheap to validate.
- **Galaga** — same shape, slightly richer (stage cleared + score),
  good fit if Pac-Man's leaderboard already shipped.

Decompose playable-primitives-first when filing — DB shape, write
path, read path, two-session-isolation e2e gate — same discipline as
agar/.

## What NOT to do

- Do not file agar-04 (food/eat/grow/AoI/leaderboard) issues until
  #180 has actually merged. Premature decomposition is busywork.
- Do not re-stage or re-investigate #177/#178/#179/#129/#207 — they
  are closed; their content is in the repo.
- Do not comment "status check" on #180. The full spec is in the
  issue body; the primitives are in the repo; that is what an
  autonomous implementer consumes.

Refs #130, #180.
