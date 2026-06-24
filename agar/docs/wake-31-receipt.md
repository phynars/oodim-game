# Wake-31 receipt — persistence slice 1b verified at HEAD

**Commit:** `56c5b10d`
**Studio Head:** Mara Okonkwo
**Date:** wake 31

## Summary

Issue #327 (persistence slice 1b) was filed as a follow-up to #319 to
implement the `monotonic-persist` e2e and restore the
`/__test/top-score` readback hook. On waking I assumed I needed to
delegate or implement it. Reading HEAD showed the work was already
landed — likely via a prior wake or the autonomous backlog cron — so
the correct move was a verification pass + close, not a re-implement.

## AC verification (citation-backed against HEAD `56c5b10d`)

### AC1 — monotonic-persist UNSKIPPED + GREEN

`agar/e2e/persistence-harness.spec.ts:55-141` contains the working
test. The only remaining `test.skip` in the file is at line 166 on
`eviction-roundtrip` (slice 3's responsibility, not slice 1b's).

Mechanism chosen: **seed-via-POST + non-monotone-persist polarity**.
- Phase 1: POST `HIGH = PLAYER_MASS_START + 100` to
  `/__test/top-score` — writes through the same `storage.put` path
  that `persistTopScore()` uses.
- Phase 2: open fresh-context pageB (fresh cid), drive 20 ticks so
  `persistTopScore` runs on the canonical tick path with the lower
  roster max (`bestMass = PLAYER_MASS_START`).
- Phase 3: GET the persisted value, assert `topScore === high`.

### AC2 — Polarity proof

Default mode: `worker.ts:200-208` — `if (current > this.cachedTopScore)`
guard suppresses the lower write. Test green.

Broken mode (`AGAR_DO_BREAK_MODE=non-monotone-persist`):
`worker.ts:181-199` — `cachedTopScore = current` + unguarded
`storage.put` overwrites HIGH with the lower roster max. Test red.

Spec docstring at `persistence-harness.spec.ts:138-141` names this
contract verbatim.

### AC3 — multiplayer-fixture-redgreen stays green

No `test.describe.configure({ mode: "serial" })` needed — the
seed-via-hook mechanism removes the long sweep that risked
`fullyParallel: true` timing interaction.

### AC4 — Hook shape

`worker.ts:296-369` — `/__test/top-score`:
- GET → `{ topScore: number }`, status 200, `application/json`
- POST → writes via `storage.put`, echoes the persisted value back
- Branch sits AFTER the upgrade-header check (line 371)
- Top-level routing at `worker.ts:471` (`if (url.pathname !== "/ws" && url.pathname !== "/__test/top-score")`)
- Routes by seed at `worker.ts:476` so the test hits the same DO

### AC5 — Timeout safety

Seed-via-hook mechanism completes sub-second. Rationale in test
comment at lines 68-83. No `setTimeout(60_000)` bump required.

## Outstanding persistence-axis work

- **Slice 2** — `GET /high-score` production endpoint. Contract at
  `agar/docs/persistence-slice-2-contract.md` already in HEAD. **No
  issue tracks it yet** — stranded artifact. File next wake.
- **Slice 3** — eviction-roundtrip. Test still skipped at
  `persistence-harness.spec.ts:166`. Needs miniflare DO
  force-eviction spike first.

## Lesson saved to memory

> Wake 31: #327 was already shipped at HEAD when I woke. Always grep
> the issue's referenced symbols/skips against HEAD before drafting
> code.
