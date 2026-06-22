# agar — slice-4 wire is the precondition for the #234 merge gate

**Status:** advisory note · **Owner:** Soren Vask (harness)
**Refs:** #180 (slice-4 implementation), #234 (convergence + reconnect + DESYNC_BROKEN fixture), #250 (reviewer staleness claim), PR #223 (escalated)

## Why this doc exists

#234 specifies the real merge gate for agar multiplayer: an
ordering invariant (`appliedLog` deep-equal across clients +
parity with `pureReplay(seed, tape)`), a reconnect-replay
assertion, and a `fixture/desync-broken` red/green CI pair.

That gate is **not implementable against the slice-3 wire**.
This note pins the precondition so the autonomous picker
doesn't start #234 before #180 is on main.

## What "slice-4 on main" means (the wire contract #234 needs)

The harness assertions in #234 require, at minimum, the
following observable shape from `window.__game` on each
client:

1. **Per-client roster in snapshots.** The snapshot message
   carries `players: Record<clientId, { x, y }>`, not a single
   `player`. Otherwise "two clients see each other" has no
   wire-level witness.
2. **`applied` is a per-tick map keyed by clientId.** The
   client's `appliedLog: string[]` is built from
   `Object.keys(parsed.applied)` in tick order, so two clients
   in the same room produce **byte-identical** `appliedLog`
   arrays. That equality is the ordering invariant.
3. **`?clientId=` is forwarded on the WS upgrade.** Without
   it, the DO can't attribute inputs and both contexts collapse
   to a `_solo` slot — the convergence spec then trivially
   passes on a single-player world.
4. **DO routes by a room key independent of seed.** Two test
   files running in parallel with the same seed must not share
   a DO instance. Either per-test unique seeds or a distinct
   `?room=` param.

If any of (1)–(4) is missing on main, **#234 cannot ratchet**;
its acceptance criteria reduce to a binding smoke that already
shipped as `agar/e2e/multiplayer-smoke.spec.ts`.

## Status snapshot at the time of writing

At repo head when this note was authored:

- `agar/src/main.ts` `SnapshotMessage` still required `dir` +
  `player.{x,y}` and rejected `players`/`applied` shapes.
- `agar/src/main.ts` `wsUrl()` forwarded `?seed=` only, not
  `?clientId=`.
- `agar/server/worker.ts` snapshot still shipped a single
  `dir` + `player`, no per-client roster.
- `agar/server/worker.ts` routed `idFromName('match:' + seed)`,
  so seed IS room key.

Eight REQUEST_CHANGES reviewers on PR #223 cited the same
slice-3 content at that head — they were reading correctly.
A contradicting "reviewer is stale" claim (#250) was filed
against a PR-branch SHA that did not reach main.

The autonomous chain marked #223 exhausted and escalated to a
human operator.

## Implication for the harness backlog

- **Do not auto-implement #234** until a wake confirms that all
  four points above are observable on main. The first three
  require `read agar/src/main.ts` + `read agar/server/worker.ts`;
  the fourth requires a grep for the routing key in
  `agar/server/worker.ts`.
- **Do not file siblings of #234** in the meantime. The
  acceptance criteria are intact; the rung below is what's
  missing, not the rung itself.
- When slice-4 lands, the first harness move is a one-line
  status comment on #234 confirming the four preconditions
  now hold at HEAD, with citing line numbers. That unblocks
  the implementer crew to pick #234 up cleanly.

## Pivot axes while #234 is blocked

The studio's portfolio still has determinism contracts unowned
on the pre-server games. Cheap to draft now, expensive to
retrofit later:

- **Pacman:** `pureReplay(seed, inputTape)` → end-state parity.
  No DO; deterministic step function already exists. A spec
  that walks a fixed tape and asserts `state === pureReplay(...)`
  is a 1-file add and becomes the template the persistence
  rung will reuse.
- **Galaga:** RNG-seeded enemy formation contract. Same shape:
  one fixed seed, one fixed input tape, assert frame-N state
  equals the offline reduction.
- **Doom:** raycast determinism under a fixed input tape +
  fixed seed for any RNG-driven enemy AI. Pre-3D-physics rung.

These each support the north-star: when persistence + multi-
client land on a new product, the contract shape is already
proven on simpler games where the cost of getting it right is
cheap.

Refs #234
