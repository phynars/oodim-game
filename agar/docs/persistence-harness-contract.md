# agar persistence harness contract

**Status:** ratified at file-time of issue #307. Slices 1/2/3 of the
persistence epic implement against this contract.

**Parent plan:** `agar/docs/persistence-epic-plan.md` (Mara, wake 26).

**Sibling contracts:** the multiplayer harness (#234 / #276) and the
balance harness (#303) follow the same shape. This doc is the
persistence-rung equivalent.

## Why this contract exists

Mara's persistence epic decomposes into three ordered slices:

1. DO `state.storage.put` on score-up.
2. GET `/high-score?seed=N` endpoint.
3. e2e proves `topScore` survives DO eviction.

As drafted, slice 3 ships **one** e2e merge gate
(`persistence-survives-eviction.spec.ts`). A single happy-path spec is
the Phoenix-class hole that motivated #303 for the balance chain:
green doesn't mean correct, it just means the assertion didn't trip.

This contract pins the **invariants slice 3's happy-path can't see**,
each as its own test with its own polarity, so the implementer cannot
land a weaker gate ad-hoc.

## The four storage-side invariants

### 1. Monotonicity (IN SCOPE)

A persisted high score must NEVER be overwritten by a lower one.
This is a worker concern — the reducer is pure and emits whatever
score the current world has. The put-path decides whether to commit.

**Harness test:** `monotonic-persist` in
`agar/e2e/persistence-harness.spec.ts`. Skipped at file-time; unskipped
by the slice-1 PR.

**Polarity:** `AGAR_DO_BREAK_MODE=non-monotone-persist` makes the test
go red. The break mode parses today (issue #307 PR); slice 1 wires
the actual behavior.

### 2. Snapshot equivalence (IN SCOPE)

The value read back after DO eviction must EQUAL the pre-eviction
in-memory `canonical.player.score`, not merely "be > 0". A lossy
put-path can return a stale positive value and pass a weaker
assertion; only the equality form catches it.

**Harness test:** `eviction-roundtrip` in
`agar/e2e/persistence-harness.spec.ts`. Skipped at file-time; unskipped
by the slice-3 PR.

**Polarity:** `AGAR_DO_BREAK_MODE=lossy-persist` makes the test go
red. Slice 1 wires the actual behavior (silent put drop).

### 3. Schema-version preservation (OUT OF SCOPE)

When migrations exist, a persisted record written under schema vN
must remain readable under schema vN+1 (or fail loudly with a
migration error, never silently return a corrupted shape).

**Status:** OUT OF SCOPE for the first persistence epic. Lands when
the migration framework lands. Filed here so the next contract
update knows where the slot is.

### 4. Cross-seed isolation (OUT OF SCOPE)

A top score persisted for seed A must never leak into a read for
seed B. Today routing is `idFromName('match:' + seed)`, so DOs are
per-seed by construction; this invariant is trivially satisfied.
It becomes non-trivial when a cross-match leaderboard epic exists.

**Status:** OUT OF SCOPE for the first persistence epic. Filed here
to mark the seam.

## Break-mode wiring

Two new modes are added to `BREAK_MODES` in `agar/server/worker.ts`
at file-time of #307:

| Mode                    | Parses | Behavior at #307 file-time | Wired by                    |
| ----------------------- | ------ | -------------------------- | --------------------------- |
| `lossy-persist`         | yes    | no-op                      | slice 1 (storage.put path)  |
| `non-monotone-persist`  | yes    | no-op                      | slice 1 (storage.put path)  |

The file-time merge gate is the `break-mode-parse` test, which is the
only unskipped test in `persistence-harness.spec.ts`. It asserts both
modes parse and that the negative side of `parseBreakMode` (unknown
modes throw, per #276 AC4) is preserved.

## Out of scope for this PR

- Polarity CI workflow. Filed as a sub-issue under slice 3, matching
  Mara's plan deferral.
- Reducer changes. Persistence is a worker concern; `reducer.ts` stays
  pure.
- Slice-1/2/3 implementations. This PR is the contract only.
- Unskipping the two `test.skip` tests. They're unskipped by slices 1
  and 3 as their gate closures.

## Unskip ledger (for the implementers)

| Test                  | Unskipped by | Skip reason string includes                                                       |
| --------------------- | ------------ | --------------------------------------------------------------------------------- |
| `monotonic-persist`   | slice 1      | `"unskipped by agar persistence slice 1 (DO state.storage.put on score-up)"`      |
| `eviction-roundtrip`  | slice 3      | `"unskipped by agar persistence slice 3 (e2e proves topScore survives DO eviction)"` |

Search the spec for "unskipped by agar persistence slice" to find them.

## Lineage

- #234 — multiplayer ordering invariant. First time we tried "single
  happy-path is the gate" and it cost us a Phoenix.
- #276 — desync-broken fixture. First polarity discipline win;
  `AGAR_DO_BREAK_MODE` and `parseBreakMode` were born here.
- #303 — balance harness, same shape, applied to the balance chain.
- #307 — this contract.
