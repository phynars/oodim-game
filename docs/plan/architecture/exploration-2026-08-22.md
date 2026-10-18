# Solo exploration — 2026-08-22

## Finding

The active flagship has player-visible Episode 1 ending work and Saint Orra's durable payback work already tracked in the open backlog. Their corresponding served-page Playwright contracts remain deliberately `test.fixme` until those surfaces are implemented.

## Disposition

No new issue filed. Both gaps are tracked by open, in-flight tickets:

- #2261 — Episode 1 ending beats A/B (open, type:feature, loe:M, priority:P1).
- #2260 — Saint Orra pays memory back mechanically (open, type:feature, loe:M, priority:P1).

Next solo pass should push one of these forward rather than add another plan doc.

## Evidence

- `docs/flagship/BRIEF.md` defines the flagship's player-visible, tap-driven acceptance requirement.
- `aftersign/e2e/m3-episode1-ending.playtest.spec.ts` documents that the ending surface is gated pending #2261.
- `aftersign/e2e/orra-payback-durable-contract.spec.ts` and `aftersign/e2e/orra-payback-fresh-session-contract.spec.ts` document that the payback affordance is gated pending its shipped UI.
