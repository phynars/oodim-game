// AFTERSIGN — Io next-job dialogue copy.
// Runnable story surface: this module keeps the post-recognition handoff
// copy as code, not a doc, so the served page can import it when the next
// continuation beat is wired.

export const IO_NEXT_JOB_DIALOGUE_ID = "io-next-job-red-tag";

export const IO_NEXT_JOB_DIALOGUE = Object.freeze({
  id: IO_NEXT_JOB_DIALOGUE_ID,
  speaker: "Io",
  beat: "io-next-job",
  choiceLabel: "Take the red tag",
  line:
    "Then take the red tag. Saint Orra will ask who sent you. Do not say my name first.",
  memoryRefs: Object.freeze(["delivery-outcome", "route-attention"]),
});

export const ioNextJobLine = () => IO_NEXT_JOB_DIALOGUE.line;
