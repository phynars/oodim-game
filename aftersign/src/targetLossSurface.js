// AFTERSIGN target-loss DOM surface marker.
//
// #1724 mints the reticle/prompt DOM nodes in index.html so #1721 can wire
// targetLossFeedbackAt into the render loop. The held-to-none transition is
// intentionally the existing packet gesture release: packetRelease() resolves
// the active state.packet gesture to a sealed/opened outcome. No feedback
// envelope is applied here; #1721 owns that render-loop wiring.
export const TARGET_LOSS_TRANSITION = "packetRelease";
