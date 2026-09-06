# Handoff: #1650 — aftersign job-offer press-juice e2e RED

Refs #1650.

## What this PR does

Removes two off-target files from the prior /code attempt on #1650:

- `apps/web/src/aftersign/issue1650Noop.ts` — an `export {}` placeholder
  with no importers. Dead code standing in for a fix that was never made.
- `aftersign/src/ioRecognitionDialogue.test.ts` — a vitest covering
  Io-recognition dialogue selection. Fine as coverage in principle, but
  it was filed under the #1650 banner, and #1650 is a served-page
  Playwright e2e failure that a unit test on a different module cannot
  repair. Removing it here to keep the fix trail honest; it can be
  re-landed on its own issue if desired.

Net diff: two file deletions. **No fix for #1650 is included.** The RED
on `main` stays RED after this merges.

## Why not fix it here

The prior session confirmed the failing spec is
`aftersign/e2e/aftersign-job-offer-press-juice.playtest.spec.ts` →
`"a tappable job offer compresses briefly and recovers"`, asserting
`scaleDrop >= 0.015` at 64 ms into the 96 ms hold and receiving `0`.
That means the shipped button on `/aftersign/?slot=…` is not applying
the `scaleFrom 0.97` press transform on `touchscreen.tap`.

The fix lives somewhere along:

- `apps/web/src/aftersign/aftersignJobTakeFeel.js` — the feel row
  (`holdMs: 96`, `scaleFrom: 0.97`, `scalePeak: 1.025`). Config only;
  reading it in isolation cannot tell you why the transform isn't landing.
- `apps/web/src/aftersign/harness/bootWindowGame.ts` — the seam that
  wires the feel row onto the served DOM element (see
  `resolveAftersignJobTakeFeel` import + `appliedJobTakeFeel` state
  around line 542; the row is resolved near line 1054).
- `aftersign/main.js` — the served-page tap handler(s) that should
  apply the transform. The prior review pinned handler sites at
  `1106 / 1246 / 1475 / 1536` but they were **not** verified as the
  actual press-envelope apply-site in this session.

Diagnosing which of those three is missing the press transform —
config not resolved onto the element, tap handler not applying the
transform, or the transform applied but on the wrong node — needs a
fresh session budget and, ideally, the Playwright trace from the
failing run (`https://github.com/phynars/oodim-game/actions/runs/34038708916`).

## Next step for whoever picks this up

1. Reproduce the failing spec locally at the same viewport / touch /
   isMobile config. If it repros, capture a trace and inspect the
   button node during the 64 ms sample: is `transform: scale(...)`
   present at all? If yes, is `scale >= 0.985` (below the drop floor)?
2. If it doesn't repro locally, treat #1650 as flake and close with
   that finding — the sibling `aftersign-job-take-feel.playtest.spec.ts`
   is not red on main, so a persistent breakage would be more visible.
3. Land the actual fix (surface, not spec — the spec's numbers came
   from `aftersignJobTakeFeel.js` and are canonical).

Do not repeat the mistake of writing a placeholder file or an
unrelated unit test and calling it a fix.
