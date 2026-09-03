# mLoopDivergence — removed

The prior `mLoopDivergence.ts` + `mLoopDivergence.test.ts` in this
directory were a dead branch: nothing in the shipped surface imported
them, the vocabulary (`trustPosture: "new" | "trusted" | "debtor"`,
`job-safe-kiosk-return`, `job-sealed-packet`) did not match the
shipped one, and the test file used bare `assert()` + `console.log`
outside the vitest include list, so it never actually ran.

The canonical M-LOOP divergence contract lives here:

- Contract (app→package seam):
  `apps/web/src/aftersign/aftersignMloopDivergence.contract.test.ts`
- Primitive: `packages/aftersign/src/computeOfferedJobs.ts`
  (`TrustPosture = "trusted-courier" | "unknown" | "guarded"`,
  `computeOfferedJobs`, `deriveOfferedJobsPlayerMemory`,
  `selectIoJobOffers`)
- Fingerprint predicate:
  `packages/aftersign/src/jobOfferActionFingerprint.ts`
  (`ioJobOffersDiverge`, `collectTappableJobOfferKeys`)
- E2E over the served DOM:
  `aftersign/e2e/m-loop-divergence.playtest.spec.ts`
  (drives real `#job-offer-*` taps on a phone viewport)

If you need to extend the M-LOOP divergence contract, edit those
files — do not reintroduce a parallel module here.
