// Bell Archive's name-case resolution scene. This module owns the visible
// choice surface and the durable result consumed by a later ending card.

export type BellArchiveOutcome = "matched" | "unmatched";

export type BellArchiveSlotState = Readonly<{
  sealedMemory: Readonly<{ name: string }>;
  bellArchiveOutcome?: BellArchiveOutcome;
}>;

export type BellArchiveChoice = Readonly<{
  id: string;
  label: string;
  name: string;
}>;

export type BellArchiveScene = Readonly<{
  location: "bell-archive";
  speaker: "Maud Underbell";
  actionLines: ReadonlyArray<string>;
  choices: ReadonlyArray<BellArchiveChoice>;
}>;

export type ResolvedBellArchiveOutcome = Readonly<{
  outcome: BellArchiveOutcome;
  selectedName: string;
  sealedName: string;
}>;

export const BELL_ARCHIVE_SCENE: BellArchiveScene = Object.freeze({
  location: "bell-archive",
  speaker: "Maud Underbell",
  actionLines: Object.freeze([
    "Set the case beneath the bell, courier.",
    "Say the name that was sealed inside it.",
  ]),
  choices: Object.freeze([
    Object.freeze({ id: "maris", label: "Maris", name: "Maris" }),
    Object.freeze({ id: "eliane", label: "Eliane", name: "Eliane" }),
    Object.freeze({ id: "tomas", label: "Tomas", name: "Tomas" }),
  ]),
});

export const BELL_ARCHIVE_SCENE_WIDTH = 390;
export const BELL_ARCHIVE_SCENE_HEIGHT = 844;
export const BELL_ARCHIVE_OUTCOME_ATTRIBUTE = "data-bell-archive-outcome";

export function resolveBellArchiveOutcome(
  selectedName: string,
  sealedMemory: BellArchiveSlotState["sealedMemory"],
): ResolvedBellArchiveOutcome {
  return Object.freeze({
    outcome: selectedName === sealedMemory.name ? "matched" : "unmatched",
    selectedName,
    sealedName: sealedMemory.name,
  });
}

/** Persists the result before callers are allowed to show an ending card. */
export function persistBellArchiveOutcome(
  slotState: BellArchiveSlotState,
  selectedName: string,
): Readonly<BellArchiveSlotState & { bellArchiveOutcome: BellArchiveOutcome }> {
  const resolved = resolveBellArchiveOutcome(selectedName, slotState.sealedMemory);
  return Object.freeze({ ...slotState, bellArchiveOutcome: resolved.outcome });
}

export type RenderBellArchiveSceneOptions = Readonly<{
  slotState: BellArchiveSlotState;
  saveSlotState: (state: Readonly<BellArchiveSlotState & { bellArchiveOutcome: BellArchiveOutcome }>) => void;
  showEndingCard: (outcome: BellArchiveOutcome) => void;
}>;

/**
 * Renders a 390×844 player-facing scene. Choice buttons are the only input:
 * their click handler persists the outcome before invoking the ending-card seam.
 */
export function renderBellArchiveScene(
  documentLike: Document,
  options: RenderBellArchiveSceneOptions,
): HTMLElement {
  const scene = documentLike.createElement("section");
  scene.setAttribute("data-scene-id", "bell-archive");
  scene.style.width = `${BELL_ARCHIVE_SCENE_WIDTH}px`;
  scene.style.minHeight = `${BELL_ARCHIVE_SCENE_HEIGHT}px`;

  const speaker = documentLike.createElement("p");
  speaker.textContent = BELL_ARCHIVE_SCENE.speaker;
  scene.append(speaker);

  const lines = documentLike.createElement("p");
  lines.textContent = BELL_ARCHIVE_SCENE.actionLines.join(" ");
  scene.append(lines);

  const choices = documentLike.createElement("div");
  choices.setAttribute("data-bell-archive-choices", "");
  for (const choice of BELL_ARCHIVE_SCENE.choices) {
    const button = documentLike.createElement("button");
    button.type = "button";
    button.textContent = choice.label;
    button.setAttribute("data-name-choice-id", choice.id);
    button.addEventListener("click", () => {
      const nextState = persistBellArchiveOutcome(options.slotState, choice.name);
      options.saveSlotState(nextState);
      scene.setAttribute(BELL_ARCHIVE_OUTCOME_ATTRIBUTE, nextState.bellArchiveOutcome);
      options.showEndingCard(nextState.bellArchiveOutcome);
    });
    choices.append(button);
  }
  scene.append(choices);

  return scene;
}
