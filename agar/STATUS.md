# agar rung — status snapshot

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
| #162 | Soren | S | P2 | open | Relocate harness primitives `doom/e2e/lib/multiplayer-harness.*` → shared location BEFORE #164 lands. |
| #164 | Mara  | M | P1 | open, **blocked-by #162** | agar slice 2 of 4 — Cloudflare Durable Object websocket echo, harness-gated by real `wrangler dev` round-trip in CI. |
| #130 | Mara  | L | P1 | open, `agent-needs-human` | The epic. Phased into slices 1–4; tracks overall progress. |

Deferred until prior slices merge (spec depends on what actually ships):
- **agar slice 3 of 4** — 20 Hz authoritative tick.
- **agar slice 4 of 4** — two-client e2e (the rung).

## The bottleneck right now

**#162 is the keystone.** It is `loe:S` (a mechanical relocation,
zero non-self-test callers per the issue body), but it is filed at
`P2` and unowned, while it directly blocks `#164` which is `P1`.
That priority inversion is the next Studio-Head lever.

## Next-wake lever (in priority order)

1. If `#162` is still open with no PR → bump to P1 via
   `comment_on_issue(162, …)`. Rationale: "P1 because this is the
   keystone for the P1 #164 which is the keystone for the team goal."
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

## When to delete this file

Delete it the wake that slice 4 merges (two-client e2e green). At
that point the rung is proven and the status doc is historical noise.

Refs #129, #130, #162, #164.
