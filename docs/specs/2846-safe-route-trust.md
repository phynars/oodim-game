# Spec — #2846 Safe-route trust acknowledgement

**Story:** #2846 · **Epic:** #2821 · **Research:** [docs/research/2846-safe-route-trust.md](../research/2846-safe-route-trust.md)

## Problem

Playtest 6 found that Io's return recall credited a "safe" choice to players who had only tapped the Lit stair route. The old wording said they "made the safe route worth trusting again". Main has since retired that line. `AFTERSIGN_PACKET_RECALL_COPY.safe` in `apps/web/src/aftersign/aftersignPacketRecallCopy.js` now reads: "Io remembers you brought the packet back sealed. She left the lamp burning: the lit stair you chose held. Keep the route lit for the next packet." `aftersignPacketRecallSafeCopy.test.ts` pins that line as a unit-level string. No served test proves the shipped ending. Nothing yet stops a player's recall from naming a route they never tapped. The case of a player with no recorded route run is not covered either.

The game has no "Take the safe job" control and no recorded safe-job choice. The first job is taken with **Take the blue-seal job** (`take-job-blue-seal-safe` in `aftersignJobOfferCopy.js`). The safe route is the **Lit stair — under Io's window** choice. The only durable fact the recall reads is `state.player.routeRisk = { lastRoute, succeeded, lastAction }`, written at `aftersign/main.js` when a route runs.

## Behaviour

At the `packet-offered` return beat, the served game renders `#packetRecallLine` from `routeRisk` through `aftersignPacketRecallToken` and `aftersignPacketRecallLine`. The recall describes only the route the player tapped:

- A sealed Lit stair run (`lastRoute: "safe"`, `succeeded: true`) shows the playtest-6 lit-stair line. That line names the lit stair. It never says "safe route" or "worth trusting again".
- A shortcut run shows the shortcut line. It never shows the lit-stair line.
- A player with no recorded route run (`routeRisk` absent) gets no recall paragraph. The token resolves to `null` and the paragraph is torn down. The recall never falls back to a default line that would credit a route or a job the player never took.

## Acceptance criteria

- AC-1: WHEN a player taps **Take the blue-seal job**, then the visible **Lit stair — under Io's window** route, and brings the packet back sealed to the `packet-offered` beat, THE `#packetRecallLine` text SHALL equal `AFTERSIGN_PACKET_RECALL_COPY.safe` AND SHALL NOT match `/safe route/i` or `/worth trusting again/i`.
- AC-2: WHEN a player reaches the `packet-offered` beat after tapping the shortcut route instead of the Lit stair, THE `#packetRecallLine` text SHALL NOT match `/lit stair/i`, `/safe route/i`, or `/worth trusting again/i`.
- AC-3: WHEN `state.player.routeRisk` is absent at the `packet-offered` beat (no route run was recorded), THE game SHALL render no `#packetRecallLine` paragraph.
- AC-4: WHEN the served acceptance suite runs at a 390×844 viewport, THE suite SHALL reach AC-1 and AC-2 by pointer taps on visible controls. It SHALL read `window.__game` only for assertions, never for input.

## Out of scope

- Re-introducing any "safe route … worth trusting again" wording. Playtest 6 retired it, and `aftersignPacketRecallSafeCopy.test.ts` forbids it.
- Adding a "Take the safe job" control or a new safe-job fact to `routeRisk` or the save schema.
- Changing the shortcut, fragile, or failed recall copy, Act II progression, save-slot identity, or the authoritative-save API.

## References

- Research: [docs/research/2846-safe-route-trust.md](../research/2846-safe-route-trust.md)
- Architecture: [docs/plan/architecture/README.md#episode-1-from-choices-to-the-ending](../plan/architecture/README.md#episode-1-from-choices-to-the-ending)
- Shipped copy: `apps/web/src/aftersign/aftersignPacketRecallCopy.js` (playtest-6 `safe` line, `aftersignPacketRecallToken`)
- Render seam: `aftersign/main.js` (`packetRecallToken` → `stampPacketRecallLine`)
- Build issue: #2846

## Constitution check

- C1: pass
- C2: pass. Served coverage uses visible-control taps (AC-4).
- C3: pass
- C4: pass
- C5: pass. The recall names only the route recorded in `routeRisk`, and an absent record renders nothing (AC-3).
- C6: pass
- C7: pass
- C8: pass
