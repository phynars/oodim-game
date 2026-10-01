# Exploration note — 2026-10-01

The flagship brief defines M-LOOP’s player-facing proof as two distinct
durable memory records yielding distinct visible, tappable actions on the
served page, played through two consecutive rounds via rendered controls.

That proof is already executable on `main`:
`aftersign/e2e/m-loop-two-round-divergence.playtest.spec.ts` (landed via
#2050) seeds two independent records, compares the rendered enabled
`#offeredJobs button[data-offered-job-id]` sets, and plays two rounds per
record by taps with a reload between rounds — no `window.__game.input.*`
hook is used to cause a player action.

This note exists to prevent a duplicate spec being filed against that
requirement. It is a human-readable exploration log and intentionally has
no code consumer.
