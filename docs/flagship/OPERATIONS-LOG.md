# Flagship operations log

Meta-moderator reconciliation notes for the AFTERSIGN slice-1 pipeline.
One entry per meta-session that changed tracker/PR state. Newest first.

## 2026-07-05 — spec-merge reconciliation (Charlie Shin)

### State found

- Issue #394 (`window.__game` story-state spec) was **done but open**: the
  deliverable merged to main via PR #403 as
  `docs/flagship/story-state-contract.md`, but the docs-only closes-guard
  blocked auto-close (same guard that no-op-closed PRs #395 and #400).
- Issue #391 (slice-1 harness implementation) was parked `agent-unroutable`
  and its inline `FlagshipTestSurface` sketch **contradicts the merged
  contract** (it predates #403).
- PR #407 (Io first-memory-beat copy) **drifts from the merged contract**:
  its sealed returning line drops the required `blue seal, unbroken`
  fragment, and it invents memory keys (`io.firstPacketOutcome`) that do
  not match the contract's `npcs.io.memories[]` ids.
- Issue #404's acceptance criteria reference a docs landing page
  (`docs/README.md`) that does not exist at the current snapshot.

### Actions taken

- **Closed #394** with a criterion-by-criterion reconciliation comment.
  One intentional deviation noted: `lastSeenBucket` was dropped from the
  surface (reviewer-flagged scope-tighten on #403; zero repo references
  remain).
- **Un-parked #391** (removed `agent-unroutable`) and pinned the merged
  contract as source of truth in a comment. Key deltas vs the stale issue
  sketch:
  - state lives at the top level of `window.__game`, not under `.state`;
  - harness controls are `input.choose/advance/forceSave/forceReload/waitForStoryIdle`;
  - memory ids are `io-remembers-blue-packet-{sealed,opened}`;
  - durable proof runs through `save.authority === 'server'` +
    `save.lastLoadProof` after `forceReload({ clearLocalState: true })`;
  - break modes: `FLAGSHIP_BREAK_MODE=drop-memory | wrong-io-line | local-only-save`.
- **Requested changes on PR #407**: restore the `blue seal, unbroken`
  fragment in the sealed returning line (or update the contract's
  Required-mappings table in the same PR), and align memory-key naming
  with the contract's authored ids.
- **Scope-corrected #404** in a comment: both the architecture entry doc
  AND the docs landing page must be created (neither exists), and the
  architecture map should center the flagship, not the frozen clone
  portfolio.

### Standing rule for contract drift

`docs/flagship/story-state-contract.md` is the single source of truth for
the `window.__game` surface. Any doc or PR that authors returning-session
lines, memory keys, or harness assertions MUST either conform to the
contract's Required-mappings table or amend that table in the same PR.
Main must never carry two contradictory sources of truth for a harness
assertion.

### Healthy / untouched

- #401 (Io recognition-beat implementation): correctly scoped, specs
  merged (#396, #402), waiting on the #391 harness. No action needed.
- No stuck PRs, no red CI, no give-up loops in `code_sessions`.
