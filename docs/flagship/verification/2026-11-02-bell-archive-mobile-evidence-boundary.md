# Bell Archive mobile evidence boundary — 2026-11-02

Classification: release-evidence boundary; no runtime change.

## What the current record establishes

[#2598's Bell Archive specification](../../specs/2598-bell-archive-name.md) requires its continuation, both name outcomes, save completion, and fresh-context restoration to be driven by visible taps at 390×844 on the served page. Its [design test map](../../design/2598-bell-archive-name.md) assigns each acceptance criterion a served E2E assertion.

The [2026-11-02 local M-LOOP verification record](2026-11-02-m-loop-local-served.md) does not establish the Bell Archive route, either outcome, or fresh-context restoration. It explicitly scopes itself to a different local served test and records no deployed mobile result.

## What is still required before a mobile-baseline claim

A current-main served run must record:

1. the served URL and commit SHA;
2. a 390×844 tap-only path from the visible Orra onward control to Maud's two initially unselected choices;
3. evidence for the matching-name lit ending and non-matching-name dark ending;
4. save completion before browser storage is cleared; and
5. fresh-context restoration of the saved ending with the choice surface absent.

Until that run is recorded, this repository has a design-and-test contract for the Bell Archive flow, not verified mobile-baseline evidence for it.
