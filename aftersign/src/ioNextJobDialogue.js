// AFTERSIGN — Io next-job dialogue copy.
//
// Runnable story surface: this module is the aftersign/-side handle
// on the post-recognition handoff line, so `main.js` can wire the
// served page without reaching into the flagship story module by
// index (`buildIoContinueBeats(reason)[1].line` — brittle to reorder).
//
// SINGLE SOURCE OF TRUTH: the WORDS are owned by
// `apps/web/src/aftersign/story/ioContinueBeats.ts::IO_NEXT_JOB_HANDOFF`
// (verbatim from docs/flagship/vertical-slice-script.md §8). This
// module RE-EXPORTS that line — it does NOT author a variant. The
// consumer e2e (`io-continue-beats-tap-playtest.spec.ts`) pins the
// shipped literal, so any drift here reds that spec on purpose.
//
// If the script rewrites the handoff, change it in ioContinueBeats.ts
// and update the e2e's HANDOFF_LINE in the same diff — this module
// will follow automatically.

import { IO_NEXT_JOB_HANDOFF } from "../../apps/web/src/aftersign/story/ioContinueBeats.ts";

export const IO_NEXT_JOB_DIALOGUE_ID = "io-next-job-red-tag";

// What this object actually SHIPS: only `line` is consumed by the
// served page — `main.js` imports `ioNextJobLine` below and stamps
// its return value into `#line`. The other fields (`id`, `speaker`,
// `beat`, `memoryRefs`) are metadata kept as a paper-trail for the
// beat this module speaks for; they are NOT rendered anywhere today.
//
// A `choiceLabel` field previously lived here (PR #1909, iter-1). It
// was removed on re-review (Soren, AI006/AI007): the ask-for-next-job
// button's label is authored elsewhere and this file had zero
// importers of the field, so the copy never reached a player.
// If a future PR wants to author that button's label, do it in the
// module `main.js` actually imports for the button — and add a played
// e2e that asserts on the label text, not on the choice id.
export const IO_NEXT_JOB_DIALOGUE = Object.freeze({
  id: IO_NEXT_JOB_DIALOGUE_ID,
  speaker: "Io",
  beat: "io-next-job",
  line: IO_NEXT_JOB_HANDOFF.line,
  memoryRefs: Object.freeze(["delivery-outcome", "route-attention"]),
});

export const ioNextJobLine = () => IO_NEXT_JOB_HANDOFF.line;
