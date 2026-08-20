// Orra's first-name dialogue — the pharmacy-sign beat where Saint
// Orra hands the courier a sealed name-case for the Bell Archive.
//
// Two-layer module: a frozen data contract (the beat's lines, choice
// prompts, and post-choice memory sentences) below the `RESOLVE` +
// `RENDER` primitives that turn a `choiceId` into (a) a resolved beat
// object and (b) a DOM stamp on the served page's `#line` / `#speaker`
// nodes. Both primitives are pure/frozen; the DOM writer is idempotent
// and returns the same resolved beat the pure resolver would.
//
// Consumers:
//   - `aftersign/main.js` imports `renderOrraFirstNameDialogue` and
//     wires it into `window.__game.renderOrraFirstNameDialogue(choiceId)`
//     so a beat that reaches this scene stamps Orra's voice into the
//     shipped `#line`/`#speaker` nodes with `data-beat-id` +
//     `data-choice-id` markers a tap harness can locate.
//   - `orraFirstNameDialogue.servedButton.test.ts` (this dir) loads the
//     real served `aftersign/index.html`, calls the writer against the
//     parsed DOM for each choice, and pins the DOM stamps + text.
//   - `servedSurface.contract.test.ts` grep-pins that main.js actually
//     imports the writer and exposes the runtime seam.
//
// Kept close to the neighboring shipped-primitive modules
// (`returnToneChoiceFeel.ts`, `tapConfirmFeel.ts`): frozen tables +
// small idempotent DOM writers, no framework dependency, no `window`
// reach — the caller passes in the `document` the writer stamps.

export type OrraFirstNameChoiceId =
  | "acceptWithoutAsking"
  | "askWhoItHurts"
  | "refuse";

export type OrraFirstNameChoice = Readonly<{
  id: string;
  label: string;
  playerLine: string;
  orraLine: string;
}>;

export type OrraFirstNameDialogue = Readonly<{
  id: "orra-first-name";
  speaker: "Saint Orra";
  location: "old-pharmacy-sign";
  premise: string;
  entryLines: ReadonlyArray<string>;
  offerLines: ReadonlyArray<string>;
  choicePrompt: string;
  choices: Readonly<Record<OrraFirstNameChoiceId, OrraFirstNameChoice>>;
  memorySentences: Readonly<Record<OrraFirstNameChoiceId, string>>;
  routeHintLines: ReadonlyArray<string>;
}>;

export const ORRA_FIRST_NAME_DIALOGUE: OrraFirstNameDialogue = Object.freeze({
  id: "orra-first-name",
  speaker: "Saint Orra",
  location: "old-pharmacy-sign",
  premise:
    "A living pharmacy sign asks the courier to carry a forgotten name to the Bell Archive.",
  entryLines: Object.freeze([
    "There you are, little postmark.",
    "No, not that name. The one the city left on you when it ran out of hands.",
    "Come closer. I have kept a hurt warm, and it is beginning to spoil.",
  ]),
  offerLines: Object.freeze([
    "A name was paid out of a mouth that loved it.",
    "Maud Underbell keeps the bell that can put it back.",
    "Carry it sealed. Do not rehearse it. Some names wake when admired.",
  ]),
  choicePrompt: "Take Orra's name-case?",
  choices: Object.freeze({
    acceptWithoutAsking: Object.freeze({
      id: "accept-without-asking",
      label: "Take it sealed.",
      playerLine: "I'll carry it.",
      orraLine:
        "Good child. Mercy first, questions after — a dangerous order, but tidy.",
    }),
    askWhoItHurts: Object.freeze({
      id: "ask-who-it-hurts",
      label: "Ask who it hurts.",
      playerLine: "Who gets hurt if I deliver it?",
      orraLine:
        "Ah. Io sent me a careful one. The answer is yes, which is not an answer, which is Vey.",
    }),
    refuse: Object.freeze({
      id: "refuse",
      label: "Refuse the case.",
      playerLine: "Find another courier.",
      orraLine:
        "I have been a sign for ninety years. I know how to wait where guilt can see me.",
    }),
  }),
  memorySentences: Object.freeze({
    acceptWithoutAsking:
      "You took Orra's name-case without asking who it would hurt.",
    askWhoItHurts:
      "You asked Orra who the restored name would hurt before accepting the case.",
    refuse: "You refused Orra's name-case at the old pharmacy sign.",
  }),
  routeHintLines: Object.freeze([
    "Up-stair until the brass gutters sing.",
    "Left at the moth lamp with no moths.",
    "If a bell rings before you knock, lie less loudly.",
  ]),
});

export type ResolvedOrraFirstNameDialogue = Readonly<{
  beatId: "orra-first-name";
  speaker: "Saint Orra";
  choiceId: OrraFirstNameChoiceId;
  externalChoiceId: string;
  lines: ReadonlyArray<string>;
  remembered: string;
}>;

/**
 * Pure resolver. Throws on an unknown choice — a caller that reaches
 * this beat with a garbled id has already broken the contract before
 * the DOM writer runs, and silently rendering an empty beat would
 * paper over the bug.
 */
export function resolveOrraFirstNameDialogue(
  choiceId: OrraFirstNameChoiceId,
): ResolvedOrraFirstNameDialogue {
  const choice = ORRA_FIRST_NAME_DIALOGUE.choices[choiceId];

  if (!choice) {
    throw new Error(`Unknown Orra first-name choice: ${String(choiceId)}`);
  }

  return Object.freeze({
    beatId: ORRA_FIRST_NAME_DIALOGUE.id,
    speaker: ORRA_FIRST_NAME_DIALOGUE.speaker,
    choiceId,
    externalChoiceId: choice.id,
    lines: Object.freeze([
      ...ORRA_FIRST_NAME_DIALOGUE.entryLines,
      ...ORRA_FIRST_NAME_DIALOGUE.offerLines,
      choice.playerLine,
      choice.orraLine,
      ...ORRA_FIRST_NAME_DIALOGUE.routeHintLines,
    ]),
    remembered: ORRA_FIRST_NAME_DIALOGUE.memorySentences[choiceId],
  });
}

// DOM attribute names — the same vocabulary the shared beat/choice
// bridge (`aftersign/src/playerVisibleBeatDom.js`) already uses, so a
// tap harness can locate this beat with the same selectors it uses
// for every other served beat.
export const ORRA_FIRST_NAME_BEAT_ATTRIBUTE = "data-beat-id";
export const ORRA_FIRST_NAME_CHOICE_ATTRIBUTE = "data-choice-id";
export const ORRA_FIRST_NAME_SPEAKER_SELECTOR = "#speaker";
export const ORRA_FIRST_NAME_LINE_SELECTOR = "#line";

// Line joiner — a single visible paragraph so the shipped `#line`
// paragraph reads as one contiguous beat (matches how the served
// page renders every other Io/Orra line). Two-space join keeps the
// prose flow without introducing punctuation the writer didn't
// author.
const joinDialogueLines = (lines: ReadonlyArray<string>) => lines.join("  ");

/**
 * DOM writer — resolves the beat, then stamps the served page's
 * `#speaker`, `#line`, `[data-beat-id]`, and `[data-choice-id]`
 * nodes so a player sees Orra's lines and a tap harness can pin
 * them via attribute selectors. Idempotent: calling twice with the
 * same choice reproduces the same DOM.
 *
 * Returns the resolved beat so a caller can also read/log the
 * `remembered` sentence for the durable memory lane.
 *
 * Throws `resolveOrraFirstNameDialogue`'s error on unknown choice.
 * Throws a clear error if the required `#line` node is missing —
 * the served surface contract test pins its presence, so a runtime
 * absence here is a genuine breakage worth failing loudly on.
 */
export function renderOrraFirstNameDialogue(
  documentLike: Document,
  choiceId: OrraFirstNameChoiceId,
): ResolvedOrraFirstNameDialogue {
  const resolved = resolveOrraFirstNameDialogue(choiceId);

  const lineNode = documentLike.querySelector(
    ORRA_FIRST_NAME_LINE_SELECTOR,
  ) as HTMLElement | null;
  if (!lineNode) {
    throw new Error(
      `renderOrraFirstNameDialogue: missing "${ORRA_FIRST_NAME_LINE_SELECTOR}" node in the served DOM`,
    );
  }

  const speakerNode = documentLike.querySelector(
    ORRA_FIRST_NAME_SPEAKER_SELECTOR,
  ) as HTMLElement | null;

  if (speakerNode) {
    speakerNode.textContent = resolved.speaker;
    speakerNode.setAttribute(ORRA_FIRST_NAME_BEAT_ATTRIBUTE, resolved.beatId);
  }

  lineNode.textContent = joinDialogueLines(resolved.lines);
  lineNode.setAttribute(ORRA_FIRST_NAME_BEAT_ATTRIBUTE, resolved.beatId);
  lineNode.setAttribute(
    ORRA_FIRST_NAME_CHOICE_ATTRIBUTE,
    resolved.externalChoiceId,
  );

  return resolved;
}
