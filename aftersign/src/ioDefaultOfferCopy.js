// Io's first offer — the served default line for the pre-packet beat.
// Kept as a named source so the string isn't an inline orphan; the value is
// byte-identical to what `aftersign/index.html:1122` boots into `#line` and to
// the literal that used to sit inline in `lineForBeat()`'s default branch, so
// this module is a pure extraction (rename, not a copy change). If you want to
// re-write the line, update BOTH this constant and `index.html:1122` in the
// same PR and add a served e2e that taps into the default-beat path and pins
// the new text via `toHaveText` — PLAYED-NOT-DRIVEN applies to copy changes.
export const IO_DEFAULT_OFFER_LINE =
  "Keep it sealed if you want the city to trust you. I will remember which version of you touches that blue kiosk.";
