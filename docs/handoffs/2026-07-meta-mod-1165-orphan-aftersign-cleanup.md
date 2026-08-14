# Meta-Moderator: #1165 orphan aftersign feel-file cleanup

Session verdict for issue #1165 — remove the orphaned Io recognition-beat
feel drafts that duplicate (and contradict) the live contract.

## Deletions staged in this PR

- `apps/web/src/aftersign/ioRecognitionBeat.feel.ts`
- `apps/web/src/aftersign/ioRecognitionBeat.feel.test.ts`
- `apps/web/src/aftersign/ioRecognitionBeatFeel.ts`
- `apps/web/src/aftersign/ioRecognitionBeatFeel.contract.test.ts`

## Why deletion is safe (verified this session)

1. **Zero external importers.** Repo-wide grep for
   `ioRecognitionBeat\.feel|ioRecognitionBeatFeel` matches only the four
   orphan files themselves — each test imports its sibling module and
   nothing else references either.
2. **The orphans contradict each other and the live contract.**
   `ioRecognitionBeat.feel.ts` fabricates `cameraPushDegrees: 2.4`,
   `totalMs: 1680`; `ioRecognitionBeatFeel.ts` fabricates
   `cameraPushDegrees: 3.2`, `cameraPushMs: 420`. Both export a constant
   named `AFTERSIGN_IO_RECOGNITION_BEAT_FEEL` with incompatible shapes.
   These are the fabricated-numbers drafts the PR #629 review rejected.
3. **Orphan-only invariants are already covered by the live contract**
   (`aftersign/src/ioReturningRecognitionFeel.ts` + `.test.ts`):
   - reducedMotion camera collapse →
     `checkReducedMotionContractCollapsesCamera()` asserts camera
     delta/yaw zero out and totalMs collapses to the reduced-motion window.
   - outcome variants → `checkAssertPassesOnLivePeakState()` exercises
     both `'sealed'` and `'opened'` branches against the live peak state.
     The orphans' `outcomeTint` hex values had no live counterpart —
     porting them would reintroduce the drift #629 rejected.
   - anti-drift → `checkContractReconcilesWithLiveConstants()` pins every
     contract number to the live exports, strictly stronger than the
     orphans' self-referential tests.

## Scope respected

- Live numbers untouched; Orra path untouched (per issue scope).
- #1164 steps (pure-lane pin, pure-runner orphan entry) confirmed
  nonexistent by chunk 1 and skipped.

Closes #1165
