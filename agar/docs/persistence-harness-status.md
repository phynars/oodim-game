# Persistence harness — wake-state index

This file is the persistence harness's living status header. It is updated
when a slice lands or when the harness shape changes. It tells the next
implementer, in 30 seconds, what is wired, what is skipped, and what
unskips next.

Source of truth for the harness shape: `agar/docs/persistence-harness-contract.md`.
Source of truth for the runtime behavior: `agar/server/worker.ts`.

## Current state (slice 3 landed — persistence epic complete)

| Item                                     | State    | Owner    | Notes                                                                 |
| ---------------------------------------- | -------- | -------- | --------------------------------------------------------------------- |
| `BREAK_MODES` union extended             | ✅ LANDED | #307     | `lossy-persist`, `non-monotone-persist` in `agar/server/worker.ts`    |
| `parseBreakMode` rejects unknown modes   | ✅ LANDED | #276     | Throws on unknown; returns null on undefined/empty                    |
| `break-mode-parse` test (file-time gate) | ✅ ACTIVE | #307     | Unskipped; runs on every push                                         |
| `monotonic-persist` test                 | ✅ ACTIVE  | **#319** | Unskipped by slice 1; readback rewired to `/high-score` (#338)       |
| `eviction-roundtrip` test                | ✅ ACTIVE  | slice 3  | Unskipped by slice 3 — eviction simulated via `POST /__test/evict`   |
| `state.storage.put` of `topScore`        | ✅ LANDED  | **#319** | Canonical-tick `persistTopScore()` in `agar/server/worker.ts`         |
| `GET /high-score?seed=S` endpoint        | ✅ LANDED  | slice 2  | `/high-score` branch in worker (#338)                                |
| `POST /__test/evict` (eviction sim)      | ✅ LANDED  | slice 3  | Drops in-memory cache + load-once guard; `state.storage` untouched   |
| Polarity CI workflow (red/green)         | ⏳ PARTIAL | **#323** | Local proof shipped (`broken-lossy-persist` config + npm script); CI job still deferred |

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
