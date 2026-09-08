# Handoff: PR #1666 blocked by pre-existing #1650 press-juice RED

Refs #1650. Related to PR #1666.

## Summary

PR #1666 refactors `apps/web/src/aftersign/aftersignJobOfferCopy.js`:

- Prettier line-wraps of long summary / ioLine / riskPrompt strings.
- Internal rename `AFTERSIGN_JOB_OFFER_COPY` → `JOB_OFFER_COPY`, with
  a `export { JOB_OFFER_COPY as AFTERSIGN_JOB_OFFER_COPY }` re-export
  at the bottom of the file so every existing importer keeps working.
- `chooseAftersignJobOfferCopy` widened to a destructured signature
  with defaults (`{ firstPacketOutcome, packetOpened, deliveredSealed,
  trustPosture, ioTrustPosture } = {}`). Both call sites
  (`aftersign/main.js:1999`, `apps/web/src/aftersign/harness/bootWindowGame.ts:809`)
  already pass object literals, so the change is backward compatible.
- Adds a `normalizePacketOutcome` helper and a `delivered_sealed`
  alias into the `trusted` branch of the outcome switch.

Reviewer summary on the PR itself confirms the diff is a safe,
non-breaking refactor with all copy fields intact on every branch
(`firstRun` / `trusted` / `opened`) and the `.d.ts` still matches.

## What is actually blocking merge

CI job `aftersign` fails on the Playwright e2e spec:

```
aftersign/e2e/aftersign-job-offer-press-juice.playtest.spec.ts
→ "a tappable job offer compresses briefly and recovers"

Expected: scaleDrop >= 0.015
Received: 0
```

The assertion measures the CSS `transform: scale(...)` applied to the
served job-offer button 64 ms into a 96 ms press hold. It is
orthogonal to this PR: the copy module contains only strings and a
memory → variant selector, and cannot produce a `scale(0.97)` press
transform.

## Why this is pre-existing, not caused by #1666

`docs/handoffs/1650-job-offer-press-juice.md` (already on `main`)
documents the same failure — same spec name, same 64 ms sample, same
`>= 0.015` floor, `Received: 0` — as of a prior /code session that
tried and failed to land a fix for #1650. That handoff states
explicitly: "The RED on `main` stays RED after this merges."

The press-transform surface implicated by that handoff:

- `apps/web/src/aftersign/aftersignJobTakeFeel.js` — feel-row config
  (`holdMs: 96`, `scaleFrom: 0.97`, `scalePeak: 1.025`).
- `apps/web/src/aftersign/harness/bootWindowGame.ts` — the seam that
  resolves the feel row onto the served DOM element
  (`resolveAftersignJobTakeFeel`, `appliedJobTakeFeel` state).
- `aftersign/main.js` — the served-page tap handlers that apply the
  transform.

PR #1666 touches none of those files. Its diff is 1 file changed
(`apps/web/src/aftersign/aftersignJobOfferCopy.js`, +53 / -21). No
call site of the copy module reads a scale value from it.

The `1650-job-offer-press-juice.md` handoff also explicitly warns
against the failure mode of "writing a placeholder file or an
unrelated unit test and calling it a fix." Editing this PR's scope
to touch `aftersignJobTakeFeel.js` from a copy-refactor branch
would be exactly that anti-pattern.

## Reviewer's own conditional

The reviewer wrote:

> Author needs to re-run the e2e against base `main`: if main's green,
> this PR broke the press-juice timing and needs a fix; if main's
> also red, it's a pre-existing flake and this can re-approve once
> stabilized.

The on-disk evidence in `docs/handoffs/1650-job-offer-press-juice.md`
establishes the "main's also red" branch of that conditional. #1650
remains open; no PR since has claimed to close it with an actual
press-transform fix.

## Unblock paths

Two mutually exclusive options; either clears this PR without
touching its scope.

1. **Fast path — accept the carve-out.** Confirm the last CI run on
   `main` reds the same spec with the same signature (`Expected >=
   0.015 / Received 0`). If it does, re-approve #1666 under the
   reviewer's stated pre-existing-flake condition. This PR does not
   introduce the failure and cannot fix it.

2. **Correct path — fix #1650 first, on its own branch.** A fresh
   /code session picks up #1650, reproduces the spec at the same
   `PHONE_VIEWPORT` / `hasTouch` / `isMobile` config, and lands the
   press-transform fix in `aftersignJobTakeFeel.js` /
   `bootWindowGame.ts` / `aftersign/main.js` (per the surfaces named
   in `1650-job-offer-press-juice.md`). Once #1650 merges green,
   rebase #1666; CI clears; the reviewer re-approves the
   already-correct copy diff.

Both leave PR #1666 as-is. Neither requires further edits to
`apps/web/src/aftersign/aftersignJobOfferCopy.js` — the diff was
already correct on the first pass.

## Not filed as a new issue

`#1650` already exists and already tracks the press-juice red. Filing
a duplicate would fragment the fix trail. This handoff exists so a
future reviewer opening #1666 sees the pre-existing-red evidence
without re-tracing it from CI logs (which are currently returning
401 on the job-logs endpoint anyway).

Refs #1650. Refs #1666.
