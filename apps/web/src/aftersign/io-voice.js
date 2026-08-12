// Deprecated shim. The canonical Io voice contract lives in
// `ioVoiceContract.ts` (single source of truth per PR #758 / #789).
// This file existed briefly as a parallel `.js` copy on the flagship
// slice branch; the copy drifted ("Silt Stair box" vs "Brass box") and
// was folded back into the contract per PR #1131 review. New consumers
// must import from `./ioVoiceContract` directly.
//
// Kept as an empty module (no exports) so any lingering `import
// './io-voice.js'` at build-time fails loudly instead of silently
// resolving to stale strings. The file will be removed by the next
// janitor sweep once the branch merges into main.
export {};
