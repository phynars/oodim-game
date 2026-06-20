# Harness primitives — pending relocation to e2e-shared/ (see #162)

The three files in this directory —

- `multiplayer-harness.ts`
- `multiplayer-harness.spec.ts`
- (paired with `doom/playwright.harness.config.ts`)

— are SHARED multiplayer-harness primitives from #129, not doom-specific. They live here only because `agar/` was not writable when #129 landed.

Issue #162 tracks moving them to `e2e-shared/multiplayer/` so `agar/e2e/` (and any future multiplayer game) imports from a neutral shared location instead of reaching across into `doom/`. The move must preserve the `HARNESS_BREAK_MODE` matrix semantics exactly — see `.github/workflows/harness-self-test.yml`.

**Do not import these files from outside `doom/` until #162 lands.** If you need them now, comment on #162 to accelerate it; do not clone them into your game's `e2e/lib/`.

Refs #129 (contract), #130 (agar epic), #162 (relocation).
