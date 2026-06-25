# Persistence slice 2 — status pointer

**Purpose:** one-screen, machine-readable index of where slice 2 lives.
Update this file when slice 2's state changes (PR opens, merges,
slice 3 supersedes). Mara owns the file; anyone may amend by PR.

> **Note on this PR's title.** The PR that introduced this file is
> titled `fix: [agar] persistence — slice 1: …(#338)`. That title is
> wrong — slice 1 is already closed (#319 + #327) and this diff is a
> docs-only status pointer for slice 2, not a fix. PR titles are
> immutable from /code iterate sessions, so the title couldn't be
> corrected in-flight. The body correctly uses `Refs #338` (not
> `Closes`), so #338 stays open after merge. Read the merge commit
> as "docs: slice 2 status pointer added," not "slice 1 shipped."

## State (wake 32, commit 2c22eb46)

- **Implementation issue:** [#338](https://github.com/phynars/oodim-game/issues/338) — IMPLEMENTED (PR pending). `GET /high-score` shipped in `worker.ts`; `GET /__test/top-score` read branch removed (POST seam kept); `high-score-shape` test added + `monotonic-persist` readback rewired to `/high-score`.
- **Spec (immutable):** `agar/docs/persistence-slice-2-contract.md` (in HEAD).
- **Prior slices:** #319 (slice 1, closed), #327 (slice 1b, closed).
- **Next slice:** 3 — eviction roundtrip — LANDED. `eviction-roundtrip`
  unskipped; eviction simulated via `POST /__test/evict` (drops in-memory
  cache + load-once guard, leaves `state.storage` intact) so the next
  `GET /high-score` re-hydrates from disk. Lossy-persist polarity proven
  via `agar/playwright.broken-lossy-persist.config.ts`. This was the
  RUNG slice — the agar persistence epic (#130) is now complete.

## What slice 2 changes

| Surface | Change |
|---|---|
| `agar/server/worker.ts` | Add `GET /high-score?seed=N`. Mirror `/__test/top-score` routing — `idFromName('match:' + seed)`, branch AFTER upgrade-header check. |
| `agar/server/worker.ts` | Remove `GET /__test/top-score` branch. Keep POST seam (slice 3 needs it). |
| `agar/e2e/persistence-harness.spec.ts` | Add file-time `high-score-shape` test (200 + `{topScore:0}` for never-played seed; 400 for missing seed; 405 for non-GET). |
| `agar/e2e/persistence-harness.spec.ts` | Rewire `monotonic-persist` phase-3 readback from `/__test/top-score` GET → `/high-score` GET. Seed phase stays POST. |
| `agar/e2e/persistence-harness.spec.ts` | `eviction-roundtrip` stays skipped — slice 3's job. |

## Merge gate (lifted from contract §"Acceptance criteria")

1. `GET /high-score?seed=S` → 200 + `{ topScore: number }`.
2. `high-score-shape` green (zero-default / 400 / 405).
3. `monotonic-persist` green after rewire.
4. Polarity proof in PR body: `AGAR_DO_BREAK_MODE=non-monotone-persist`
   → `monotonic-persist` goes RED.
5. `agar-multiplayer-fixture-redgreen` (#276) + persistence polarity
   workflow (#323) stay GREEN.
6. `GET /__test/top-score` branch removed from `worker.ts`; POST stays.

## Immutables across the slice

- Canonical-tick `persistTopScore()` write path — #319 review made
  it immutable.
- `allowUnconfirmed: true` on `storage.put` — #327 immutability note.
- `multiplayer-convergence.spec.ts`, `multiplayer-smoke.spec.ts`,
  `tick.spec.ts`, `client-surface.spec.ts`, `playwright-binding.ts`
  — untouched.

## When this file changes

- PR opens against #338 → add "PR: #NNN" line under State.
- PR merges → flip slice 2 to CLOSED, file slice 3, update pointer to
  point at slice 3's status file.
- Slice 3 lands → archive this file or fold into a single
  persistence-rung status doc.

Refs #130, #338, #319, #327, #307.
