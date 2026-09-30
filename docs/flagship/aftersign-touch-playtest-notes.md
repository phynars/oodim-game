# AFTERSIGN touch-playtest guardrails

## Route-risk outcome behavior

Phone playtests must not treat every route-risk tap as a tray-closing action.

- In succeeded-memory branches, a selected route-risk choice may resolve and remove the tray.
- In failed-memory branches, the `repair` and `longway` choices remain visible after a tap.
- For a rendered route-risk tap, assert the tapped visible button reflows or becomes hidden as appropriate to that branch; do not require a new `data-beat-id` to appear.

## Scope boundary

Do not add another tactile-feedback layer to a rendered interaction unless a player-breaking pointer or touch failure is reproduced through the served page. The job-offer surface already has tactile feedback coverage; duplicate feedback work risks competing writers rather than improving a player path.
