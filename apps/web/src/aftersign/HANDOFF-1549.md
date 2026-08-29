# PR #1549 — handoff, cannot wire without a served-page path

The reviewer on #1549 asks me to:

1. Wire `resolveAftersignJobTakeFeel` into `apps/web/src/aftersign/main.js`
   (allegedly line 222, alongside `tapConfirmFeel` L202 / `returnToneChoiceFeel`
   L170 / `ioJobOfferSelectFeel` imports).
2. Render a `[data-aftersign-job-take]` button in `apps/web/src/aftersign/index.html`.
3. Add an e2e spec that taps that button (no `game.input.choose` harness hook).

I cannot execute (1) or (2) from this session's snapshot.

## What I verified

- `grep tapConfirmFeel|returnToneChoiceFeel|ioJobOfferSelectFeel` scoped to
  `apps/web/src/aftersign/**/main.js` → **0 matches, 0 files** at commit
  `fb2a74d`. No `main.js` exists at the path the reviewer cites.
- `grep data-aftersign-tap-choice|data-aftersign-return-surface|data-aftersign-job-take`
  → the ONLY producers of those attributes in the repo are:
    - test files (`*.test.ts`, `*.consumer.test.ts`)
    - `apps/web/src/aftersign/harness/bootWindowGame.ts` (the vitest harness)
    - `apps/web/src/aftersign/returnToneChoiceFeel.ts` (as a selector constant)
  Zero shipped `index.html` mounts them. Every sibling feel the reviewer
  names as a "correctly wired" precedent is wired the SAME way #1549 is:
  imported by `bootWindowGame.ts`, consumed by a `*.consumer.test.ts`, no
  served page.

## Why this is a handoff, not a fix

The reviewer's blocking pattern — "CONSUMER + PLAYED-NOT-DRIVEN" against a
served page — cannot be satisfied because the served page does not exist
in this repo snapshot at the path cited. Fabricating a `main.js` and
`index.html` de novo would be a much larger scope than #1549 (it would
introduce the first served aftersign surface for the whole directory)
and would need to happen for every sibling feel too, not just this one.

## What needs to happen next

Options for whoever picks this up:

- **If the served page IS in the repo** at a path I missed
  (e.g. `apps/web/public/aftersign/`, `apps/web/aftersign/`, a different
  package), point me at it and I will wire the resolver + render the
  button + add a real-tap e2e spec.
- **If the served page ISN'T in the repo yet**, this PR's blocking
  feedback is a systemic ask across every aftersign feel, not a
  #1549-specific defect. File a separate issue to bootstrap the served
  aftersign surface, and re-evaluate #1549 against the same
  "harness-only consumer explicitly justified" bar that #1404 was
  eventually merged under.

## Prior art (#1404)

PR #1404 was merged with harness-only consumers after the reviewer
accepted: "Harness-only consumer is explicitly justified in comments,
matching the pattern of sibling modules in this file
(getIoContinueBeats, getOffe…)." #1549 currently follows the same
pattern. If that bar has shifted for #1549, the shift needs to apply
retroactively to the sibling feels too.
