/**
 * Io Vale's served-scene copy.
 *
 * Keep the decision in the rendering layer: these lines name a concrete
 * memory fact, then make it useful. They do not explain the memory system.
 *
 * Wire-in contract: every export here is either (a) already rendered
 * verbatim into the served DOM at boot (grep the string in
 * `aftersign/index.html`) or (b) written into a DOM node at runtime
 * by `aftersign/main.js`. A line with no consumer is an orphan and
 * reds the served-surface contract test in
 * `apps/web/src/aftersign/servedSurface.contract.test.ts`.
 *
 * Neighbor voice modules `main.js` also imports from `./src/`:
 *
 *   - `ioLoopConsequenceCopy.js` — #1765, packet-offered beat
 *   - `ioNextJobDialogue.js`      — io-next-job beat
 *   - `npcMemoryDialogue.js`      — terminal-handoff beat
 *
 * File-stem uniqueness: this module MUST be the only `ioVoice.*` in
 * `aftersign/src/`. A sibling `ioVoice.ts` would collide on the bare
 * stem and let an extensionless import resolve either file
 * non-deterministically (Soren's second blocker on PR #1829).
 */
export const IO_VOICE = Object.freeze({
  greeting: "Night Post is closed to excuses. Open to couriers.",
  packetOffer: "Blue seal. Silt Stair box. Do not improve the message on the way.",
  routeHint:
    "Lanterns mark the dry boards. Brass signs mark the honest ones. Follow both.",
  returned: Object.freeze({
    sealed:
      "You came back. So did the blue seal, unbroken. That gives me two facts to trust.",
    opened:
      "You came back. The seal did not. I can use one of those facts.",
    unknown: "You came back. I have one fact. Bring me another.",
  }),
  listened: "You listened before you ran. Rare habit. Keep it.",
  skipped: "You found the box anyway. Next time, let me finish saving your life.",
});

export function ioReturnLine(packetOutcome) {
  return IO_VOICE.returned[packetOutcome] ?? IO_VOICE.returned.unknown;
}

/**
 * Spoken when the player releases the packet aim before the reticle
 * has locked a target — the "you almost lost it" reassurance.
 *
 * Rendered surface: `#targetLossPrompt` in `aftersign/index.html`
 * (a `[aria-live="polite"]` paragraph beneath the aim reticle). The
 * paragraph SHIPS EMPTY in the HTML source; `aftersign/main.js`
 * imports this constant and stamps its `textContent` at boot, so
 * this file is the SINGLE SOURCE OF TRUTH for the line. A rename
 * here propagates to the DOM automatically — no HTML mirror to hold
 * in sync. The paragraph stays live through the target-loss envelope
 * authored in `aftersign/src/targetLossFeedback.ts` (100ms — plateau
 * at opacity 1 for 24ms, then linear fade to 0).
 *
 * Contract pin: `apps/web/src/aftersign/servedSurface.contract.test.ts`
 * asserts that `aftersign/main.js` (a) imports this identifier from
 * `./src/ioVoice.js` and (b) writes it onto `#targetLossPrompt`'s
 * `textContent` at boot. A refactor that unwires either half reds
 * the pin BEFORE any player-visible drift.
 *
 * Played-not-driven assertion: `aftersign/e2e/target-loss-feedback.spec.ts`
 * loads the served page and asserts the prompt's rendered text
 * equals this constant — proving the runtime stamp lands on the
 * real DOM in a real browser, not just a static-HTML pin.
 */
export const IO_TARGET_LOSS_LINE =
  "Keep your hands steady. The packet is still there.";
