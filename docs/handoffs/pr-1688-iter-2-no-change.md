# PR #1688 iter-2 — deliberate no-op handoff

Soren Vask left a **non-blocking COMMENT** on PR #1688 (not
REQUEST_CHANGES). Their review:

> **Verified:** `main.js:3927` — `confirmShakeXContribution =
> failureReducedMotion ? 0 : confirmEnvelope.hudShakeX` is correct,
> `failureReducedMotion` is pre-existing at `:3866` and in scope. Under
> reduced motion both `--confirm-shake-x` terms zero out; kills the
> `peakShakeXAbs = 7` CI failure. `reducedMotionPreference.js`'s switch
> from cached `matches` to live `mediaQuery.matches` per call is the
> right root-cause fix for the CDP emulation race.
>
> **Why COMMENT not APPROVE:** CI is red on `agent/9e7eb29b` and the
> review tool blocks APPROVE on that. The 401 on job-logs means I can't
> confirm which spec failed. Prior failures were all `peakShakeXAbs`,
> which this fix zeros by construction — red is likely stale, or a
> residual on `peakShakeY ≤ 2`, which this PR doesn't touch. Re-run CI;
> if green, this flips to APPROVE.

## Why this iteration adds no code changes

The reviewer's ask is **"re-run CI"**, not **"change the diff."**
Editing anything invalidates their line-by-line verification of the
two files they already cleared:

1. `aftersign/main.js:3927` — `confirmShakeXContribution` gated by
   `failureReducedMotion`.
2. `aftersign/src/reducedMotionPreference.js` — live `mediaQuery.matches`
   read per call.

## Verification of the fix's coverage against the failing spec

Spec: `aftersign/e2e/packet-cancel-reduced-motion-failure-sting-played.spec.ts`

Assertions at lines 333–334:

    expect(highWater.peakShakeXAbs).toBe(0);
    expect(highWater.peakShakeY).toBeLessThanOrEqual(2);

### X-axis (`peakShakeXAbs === 0`) — covered by this PR

`aftersign/main.js:3928`:

    `${confirmShakeXContribution - Math.round(failureWobble * FAILURE_FEEDBACK.hudShakePx)}px`

Both terms zero under reduced motion:

- `confirmShakeXContribution` → forced to `0` by the fix at `:3927`.
- `failureWobble` → already `0` under reduced motion (pre-existing
  behavior in the failure-sting envelope, per spec comment at `:16`).

Result: `--confirm-shake-x = "0px"` for every sampled frame → the
high-water observer at `:124` never advances past 0.

### Y-axis (`peakShakeY <= 2`) — untouched, was already green

`aftersign/main.js:3929`:

    `${confirmEnvelope.hudLiftY + Math.round(failureFalloff * FAILURE_FEEDBACK.hudDropPx)}px`

This PR does not modify either term. The spec comment at
`:316` calls `hudDropPx` "the pinned hudDropPx ceiling" — a static
bound the spec was already asserting before this PR shipped. If the
Y-axis were the residual, it would have red'd every prior iteration
of #1688 too.

## Infra caveat — same 401 the reviewer hit

`get_check_results` on `agent/9e7eb29b` returns
`Test aftersign WebGL e2e (Playwright)` as the failed step, log excerpt
gated by the same GitHub 401 Soren flagged. Cannot inspect the
individual failing assertion. Not filing a new infra issue here —
`oodim#1319` (referenced in the review tool's own hint text) already
tracks the review-token rotation class.

## What lands on the PR after this handoff

The harness pushes this doc as the iter-2 commit. That triggers a
fresh CI run against the identical code from iter-1. Two outcomes:

- **CI green** → stale-red hypothesis confirmed; re-review APPROVEs
  per Soren's stated flip condition, auto-merge.
- **CI red** → not stale; the residual is a real regression this
  fix doesn't cover, and iter-3 needs the actual log (blocked on
  the 401) or a local Playwright repro to diagnose. Handoff to a
  human with Actions:Read scope at that point.

Refs #1688
