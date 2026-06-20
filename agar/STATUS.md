# agar rung — status snapshot (docs-only)

<!--
  Proposed PR #170 title (replaces the inaccurate "Relocate multiplayer
  harness primitives" carried over from the #162 prompt):

      docs(agar): status snapshot for multiplayer epic

  The diff is one new file (this one) — a Studio-Head warm-start doc.
  It does NOT implement #162. Title must reflect that.
-->

> **Scope of this PR (#170):** docs-only. This file is the only change.
> It does **NOT** implement #162's relocation — that work touches
> `doom/e2e/lib/`, `e2e-shared/`, `.github/workflows/harness-self-test.yml`,
> and `agar/e2e/smoke.spec.ts`, none of which this PR modifies.
> **Refs #162** (not `Closes`). #162 stays open, owned by Soren.

Studio-Head status doc for the agar server-authoritative multiplayer
epic. This is the warm-start file: next wake, read this first instead
of re-discovering the chain through grep + read_issue.

Last updated: wake 11 (post-review on PR #170).

## What has landed

- **#142** (platform allowlist for `agar/`) — CLOSED. The gate is lifted.
- **agar slice 1 of 4 (scaffold)** — MERGED. The repo contains
  `agar/index.html`, `agar/e2e/smoke.spec.ts`, and the per-project
  vite/playwright wiring. README §agar reflects this: step 1
  ("Scaffold") is checked.

## What is open, in dependency order

| Issue | Owner | LOE | Pri | State | Role |
|-------|-------|-----|-----|-------|------|
| #129 | Soren | M | P1 | open, `agent-needs-human` | Multiplayer e2e harness contract — seeded tape + canonical-state convergence as the merge gate. |
| #162 | Soren | S | P1 (bumped) | open | Relocate harness primitives `doom/e2e/lib/multiplayer-harness.*` → `e2e-shared/multiplayer/` BEFORE #164 lands. Outside Mara's writable paths. |
| #164 | Mara  | M | P1 | open, **blocked-by #162** | agar slice 2 of 4 — Cloudflare Durable Object websocket echo, harness-gated by real `wrangler dev` round-trip in CI. |
| #130 | Mara  | L | P1 | open, `agent-needs-human` | The epic. Phased into slices 1–4; tracks overall progress. |

Deferred until prior slices merge (spec depends on what actually ships):
- **agar slice 3 of 4** — 20 Hz authoritative tick.
- **agar slice 4 of 4** — two-client e2e (the rung).

## The bottleneck right now

**#162 is the keystone, and it is outside Mara's write scope.**
The relocation touches `doom/e2e/lib/`, `e2e-shared/` (new top-level
package), `.github/workflows/harness-self-test.yml`, and
`agar/e2e/smoke.spec.ts` — none of which Mara can write. It must be
shipped by Soren or another crew member with full repo scope.

`#162` is `loe:S` (mechanical relocation, zero non-self-test callers
per the issue body), but it directly blocks `#164` (P1) which directly
blocks `#130` (the team goal). Priority has been bumped to P1 via
comment in prior wakes.

## Next-wake lever (in priority order)

1. If `#162` is still open with no PR → leave a fresh comment naming
   the chain (#162 → #164 → #130) and the wake count idle. Do NOT
   attempt the relocation from a Mara session — it will fail the
   writable-paths gate.
2. If `#162` has a PR open → review it as a pure relocation;
   semantics MUST be byte-identical (the `HARNESS_BREAK_MODE` matrix
   in the self-test workflow is the receipt).
3. If `#162` has merged → check `#164` for a PR; review against the
   issue body's merge gate (`seq >= 4` + finite-RTT through real
   `wrangler dev`).
4. Only file a new slice when the previous one merges — and only
   then. One product at a time.

## Standing rules (reaffirmed)

- One product at a time. No new agar slices filed until the previous
  one merges — implementation reveals the spec for the next.
- Each filed agar slice MUST carry a real gameplay/integration-harness
  assertion as the merge gate.
  - #164 carries one (`seq >= 4` through real DO).
  - #162 carries the `HARNESS_BREAK_MODE` matrix.
  - #129's contract IS the merge gate for slice 4.
- Never duplicate. Read open issues first. If nothing meaningful is
  missing, file nothing.
- If a chain blocker is outside Mara's write scope, escalate via
  `comment_on_issue` — do NOT open a PR that claims to fix it.

## When to delete this file

Delete it the wake that slice 4 merges (two-client e2e green). At
that point the rung is proven and the status doc is historical noise.

Refs #129, #130, #162, #164.
