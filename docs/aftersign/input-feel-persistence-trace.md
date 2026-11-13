# AFTERSIGN input-feel and persistence trace

This trace records the merged paths behind the closed items raised in the #2637 / #2554 / #2511 finding. It separates player-visible input and feedback timing from durable-persistence and dialogue-reachability work.

## #2637 — durable player-memory retrieval

The implementation is PR #1642 (commit `2159b07`, “Frontend: Wire aftersign/main.js to load and save player memory”). Its change list updates `aftersign/main.js`, four served playtests, the M-loop copy module, and a focused M-loop memory-gate test.

The runtime change boots from `readAuthoritativeSave`, sends route-attention commits through `persistAuthoritative`, and makes the explicit save path await the same authoritative writer. It also retains a deliberately isolated `local-only-save` diagnostic fallback. The tests exercise memory divergence, loop-divergent offered actions, and route-risk isolation.

**Input/feedback assessment:** this work is adjacent to input: real route interactions now produce durable writes. It does not introduce a tap target, gesture recognizer, visual press treatment, audio cue, animation timing, or input-to-render latency change.

## #2554 — Saint Orra red-tag handoff

The original carry-over was delivered through the red-tag progression line, including PR #2199 (commit `a2127a2`, “Round 2: ‘Take the second packet’ (red tag to Saint Orra) drops …”), with later delivery/reachability corrections including #2219, #2357, #2597/#2630, and the current Episode 1-to-Saint served test in #2780 (commit `241e5ea`).

Commit `241e5ea` changes only `aftersign/e2e/episode-one-ending-served.spec.ts`; its subject is a player carrying the tag from the Episode 1 ending to Saint.

**Input/feedback assessment:** the progression is player-facing and exercised via a served test, but the record here establishes story-flow reachability rather than a control-feel or feedback-timing modification. It does not justify a tactile claim without a human served-device replay.

## #2511 — Io skipped-route recognition

The issue was delivered by #2515 (commit `1cd6148`, “Render Io skipped-route recognition in the playable return flow”), with a follow-up import/wiring correction in #2514 (commit `1abaa7e`, “Import Io route-return line helper in aftersign main”).

Commit `1cd6148` adds the `ioRouteReturnRender` runtime helper and unit test, extends `memoryFacts`, wires it in `aftersign/main.js`, and adds `aftersign/e2e/io-skipped-route-return.playtest.spec.ts`. Commit `1abaa7e` further updates `aftersign/main.js` and `aftersign/e2e/io-voice-served.spec.ts`.

**Input/feedback assessment:** this is dialogue selection and renderer wiring from route state, with served flow coverage. It does not modify the mechanics or timing of the player action that created the route state.

## Conclusion

Diego’s concern is only partly supported: #2637 crosses the persistence boundary immediately after player actions, so persistence regressions can affect the perceived consequence of a tap. #2554 and #2511 make results reachable and renderable after player input. None of these merged paths is evidence of an input-feel or feedback-timing change, and none substitutes for a human served-device replay with a deployed URL, SHA, and fresh-browser restoration result.
