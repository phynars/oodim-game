// Io's job-accepted voice — one line spoken as a receipt when the
// player taps one of the offered jobs at the `packet-offered` beat.
// Story-first principle: a tap on a route commitment must LAND on
// the served dialogue surface, not only in the invisible action
// ledger (`state.interaction.lastAction`). The line names the route
// the player chose and promises Io will keep the return open.
//
// SEAM: this module authors NO scene logic and NO recognition copy.
// `#line.textContent` at the recognition beat is owned by
// `aftersign/src/ioRecognitionDialogue.ts::RETURNING_LINES` (pinned
// by `io-phone-ready-look-sound-contract.spec.ts` on `lineText` and
// by `flagship-surface-contract.spec.ts:514` on
// `returning.npcs.io.lastLine`). The served consumer therefore
// renders this line into ITS OWN sibling paragraph
// (`<p id="ioJobAcceptedLine">` inside the visible `#offeredJobs`
// tray, keyed by `data-aftersign-io-job-accepted-line=<jobId>`) and
// leaves `state.npcs.io.lastLine` untouched. Same shape as the
// `#ioConsequenceLine` sibling for `ioLoopConsequenceLine` and the
// `#ioReturnLine` sibling for `ioReturnLine`.
//
// Consumers on record:
//   • `aftersign/main.js` — THE SERVED-PAGE CONSUMER. Inside the
//     mloop-action click handler at the `packet-offered` beat, after
//     `state.interaction.lastAction` is composed, stamps the selected
//     line into `<p id="ioJobAcceptedLine">` inside the visible
//     `#offeredJobs` tray, with
//     `data-aftersign-io-job-accepted-line=<offer.id>` mirroring the
//     tapped jobId. This is the DOM a real player reads.
//   • `aftersign/e2e/io-job-accepted-served.spec.ts` — real-taps the
//     served `#job-offer-<jobId>` button and pins the sibling
//     paragraph's textContent + jobId stamp per branch (safe-default
//     on first visit, night-transfer on the looped return).
//
// Keep this copy separate from the offer labels: labels say what is
// available; this line says the player's tap has changed the plan.

/**
 * Selected line for the accepted-offer receipt beat.
 *
 * @param {string} label - The offered job's authored label (the
 *   same text the tapped `#job-offer-<jobId>` button renders).
 * @returns {string}
 */
export const ioJobAcceptedLine = (label) =>
  `Marked: ${label}. Take the route you chose — I will keep the return open.`;
