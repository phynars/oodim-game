/**
 * Independent player-visible baselines for served AFTERSIGN recognition.
 *
 * These values deliberately live outside the runtime dialogue module so a
 * served-flow assertion detects a bundle whose copy drifts from the release
 * contract rather than reproducing the source value under test.
 */
export const OPENED_RETURNING_RECOGNITION_LINE =
  "I remember you: blue route delivered. The seal did not survive. The kiosk kept the route; I kept your name beside the risk.";

export const SEALED_RETURNING_RECOGNITION_LINE =
  "I remember you: blue seal, unbroken. The kiosk kept the route; I kept your name beside it.";
