// Shared recognition-entry timestamp helper.
// A recognition beat must remember the instant it became interactive so the
// pointer release that entered it cannot also commit a return-tone choice.
export const recognitionEnteredAt = (now = performance.now()) => now;
