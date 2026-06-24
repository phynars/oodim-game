# Persistence harness — wake-state index

This file is the persistence harness's living status header. It is updated
when a slice lands or when the harness shape changes. It tells the next
implementer, in 30 seconds, what is wired, what is skipped, and what
unskips next.

Source of truth for the harness shape: `agar/docs/persistence-harness-contract.md`.
Source of truth for the runtime behavior: `agar/server/worker.ts`.

## Current state (as of slice 1 PR, #319)

| Item                                     | State    | Owner    | Notes                                                                 |
| ---------------------------------------- | -------- | -------- | --------------------------------------------------------------------- |
| `BREAK_MODES` union extended             | ✅ LANDED | #307     | `lossy-persist`, `non-monotone-persist` in `agar/server/worker.ts`    |
| `parseBreakMode` rejects unknown modes   | ✅ LANDED | #276     | Throws on unknown; returns null on undefined/empty                    |
| `break-mode-parse` test (file-time gate) | ✅ ACTIVE | #307     | Unskipped; runs on every push                                         |
| `state.storage.put` of `topScore`        | ✅ LANDED | **#319** | `EchoRoom.persistTopScore` writes `max(p.bestMass)` on canonical tick |
| `lossy-persist` runtime behavior         | ✅ LANDED | **#319** | put is a no-op; cache untouched so reads see prior persisted value    |
| `non-monotone-persist` runtime behavior  | ✅ LANDED | **#319** | put writes unconditionally; drops `>` guard                           |
| Storage hydration on construct           | ✅ LANDED | **#319** | `blockConcurrencyWhile` seeds `cachedTopScore` before first tick      |
| `monotonic-persist` test                 | ⏸ SKIPPED | **#327** | Slice 1b — e2e drive + readback hook isolated to avoid convergence flake |
| `eviction-roundtrip` test                | ⏸ SKIPPED | slice 3  | Unskip reason: `"unskipped by agar persistence slice 3 …"`            |
| `GET /high-score?seed=S` endpoint        | ❌ PENDING | slice 2  | Not in worker yet                                                     |
| Polarity CI workflow (red/green)         | ❌ PENDING | **#323** | Unblocked by slice 1b unskipping `monotonic-persist`                  |

### Slice 1 deviation from #319's AC4 (transparently noted)

The #319 issue body's AC4 asked slice 1 to also unskip the `monotonic-persist`
e2e. Slice 1 ships the **worker runtime** (ACs 1, 2, 3, 6) but keeps the
e2e skipped — its unskip is delegated to **#327 (slice 1b)**. Rationale:
the e2e drive needs a temporary `/__test/top-score` readback hook (slice 2's
proper endpoint isn't here yet) and a chosen low-write mechanism; bundling
that into slice 1 risks destabilizing `multiplayer-convergence` under
`fullyParallel: true`. Splitting keeps the worker diff reviewable in
isolation and the e2e tractable as its own PR. AC5's polarity proof
necessarily moves with the e2e to slice 1b.

## How the slices interlock

```
  #307 (contract)           ──> LANDED  ──> defines unskip strings + break modes
        │
        ▼
  #319 (slice 1: storage.put + break-mode runtime behavior)
        │  unskips `monotonic-persist`
        │  wires `lossy-persist` + `non-monotone-persist` at the put call site
        ▼
  #323 (polarity CI workflow)
        │  matrix: { default, AGAR_DO_BREAK_MODE=non-monotone-persist }
        │  default → green; break-mode → red (exit code inverted)
        ▼
  slice 2 (GET /high-score?seed=S)
        │  read endpoint; harness reads via this, not via DO internals
        ▼
  slice 3 (e2e: persistence survives eviction)
        │  unskips `eviction-roundtrip`
        │  extends #323 polarity matrix with `lossy-persist` job
```

## What to read before picking up the next slice

1. `agar/docs/persistence-harness-contract.md` — the invariants, in
   prose. Every assertion in the spec file has a paragraph here
   explaining what it protects and how to break it.
2. `agar/e2e/persistence-harness.spec.ts` — the spec file. The skip
   reasons name the issue that owns the unskip.
3. `.github/workflows/agar-multiplayer-redgreen.yml` — the precedent
   for #323. Copy the shape, swap the env var and the spec path.

## Update protocol

When a slice lands, update the table above in the same PR that lands
the slice. The "Owner" column links the implementer's issue; the
"State" column is one of ✅ LANDED / ⏸ SKIPPED / ❌ PENDING. Do not
add new rows without a corresponding spec test in
`agar/e2e/persistence-harness.spec.ts` — this index mirrors the spec,
it does not describe aspirations.

Refs #307 #319 #323.
