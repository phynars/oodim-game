// Bell Archive's name-case resolution scene. This module owns Maud's live
// choice surface (rendered by aftersign/src/maudBellArchive.js) and the
// matched/unmatched outcome consumed by the ending card.

export type BellArchiveOutcome = "matched" | "unmatched";

export type BellArchiveSealedMemory = Readonly<{ name: string }>;

export type BellArchiveChoice = Readonly<{
  id: string;
  name: string;
}>;

export type ResolvedBellArchiveOutcome = Readonly<{
  outcome: BellArchiveOutcome;
  selectedName: string;
  sealedName: string;
}>;

export const BELL_ARCHIVE_SPEAKER = "Maud Underbell";
export const BELL_ARCHIVE_TITLE = "Maud Underbell — Bell Archive";
// C5: Maud's own action line; the ending card carries the Io/Orra/Maud lines.
export const BELL_ARCHIVE_PROMPT = "Maud opens the archive. Which name did the bell keep?";

export const BELL_ARCHIVE_SCENE_WIDTH = 390;
export const BELL_ARCHIVE_SCENE_HEIGHT = 844;
export const BELL_ARCHIVE_OUTCOME_ATTRIBUTE = "data-bell-archive-outcome";

const BEAT_ATTR = "data-beat";
const MAUD_BEAT_ID = "maud-bell-archive";
const NAME_CHOICE_ATTR = "data-maud-name-choice";

/** The live choice set: the sealed name plus two archive decoys. */
export function bellArchiveChoices(sealedName: string): ReadonlyArray<BellArchiveChoice> {
  return Object.freeze([
    Object.freeze({ id: "remembered-name", name: sealedName }),
    Object.freeze({ id: "archive-decoy", name: "Mara Vell" }),
    Object.freeze({ id: "archive-decoy-second", name: "Orra Bell" }),
  ]);
}

export function resolveBellArchiveOutcome(
  selectedName: string,
  sealedMemory: BellArchiveSealedMemory,
): ResolvedBellArchiveOutcome {
  return Object.freeze({
    outcome: selectedName === sealedMemory.name ? "matched" : "unmatched",
    selectedName,
    sealedName: sealedMemory.name,
  });
}

export type RenderBellArchiveSceneOptions = Readonly<{
  sealedName: string;
  /** Persist the outcome to slot state. The ending card waits for this to settle. */
  persistOutcome: (
    resolved: ResolvedBellArchiveOutcome,
    choice: BellArchiveChoice,
  ) => Promise<unknown> | unknown;
  /** Render the ending card into the scene's slot, after persistence settles. */
  showEndingCard: (slot: HTMLElement, resolved: ResolvedBellArchiveOutcome) => void;
}>;

// Class names are separate tokens so no space-joined literal is mistaken
// for player copy by scripts/served-reach.mjs.
const addClasses = (el: HTMLElement, ...names: string[]) => {
  if (el.classList && typeof el.classList.add === "function") el.classList.add(...names);
  else el.className = names.join(" ");
};

/**
 * Renders Maud's Bell Archive scene (phone-first, max 390px wide). The choice
 * buttons are the only input. A tap resolves the outcome, stamps it on the
 * scene, awaits `persistOutcome`, and only then calls `showEndingCard`.
 */
export function renderBellArchiveScene(
  doc: Document,
  options: RenderBellArchiveSceneOptions,
): HTMLElement {
  const scene = doc.createElement("section");
  addClasses(scene, "episode-one-ending", "maud-bell-archive");
  scene.setAttribute(BEAT_ATTR, MAUD_BEAT_ID);
  scene.setAttribute("data-scene-id", "bell-archive");
  scene.style.pointerEvents = "auto";
  scene.style.maxWidth = `${BELL_ARCHIVE_SCENE_WIDTH}px`;

  const title = doc.createElement("strong");
  title.textContent = BELL_ARCHIVE_TITLE;
  const prompt = doc.createElement("p");
  prompt.className = "episode-one-ending__bell";
  prompt.textContent = BELL_ARCHIVE_PROMPT;
  const choices = doc.createElement("div");
  choices.className = "maud-bell-archive__choices";
  const endingSlot = doc.createElement("div");
  endingSlot.className = "maud-bell-archive__ending-slot";
  endingSlot.setAttribute("aria-live", "polite");

  let locked = false;
  const sealedMemory = Object.freeze({ name: options.sealedName });
  for (const choice of bellArchiveChoices(options.sealedName)) {
    const button = doc.createElement("button");
    button.type = "button";
    addClasses(button, "choice", "maud-bell-archive__choice");
    button.textContent = choice.name;
    button.setAttribute(NAME_CHOICE_ATTR, choice.id);
    button.addEventListener("click", async () => {
      if (locked) return;
      locked = true;
      choices.querySelectorAll("button").forEach((item) => {
        item.removeAttribute("data-selected");
        item.setAttribute("aria-pressed", "false");
        (item as HTMLButtonElement).disabled = true;
      });
      button.setAttribute("data-selected", "true");
      button.setAttribute("aria-pressed", "true");
      const resolved = resolveBellArchiveOutcome(choice.name, sealedMemory);
      scene.setAttribute(BELL_ARCHIVE_OUTCOME_ATTRIBUTE, resolved.outcome);
      try {
        await options.persistOutcome(resolved, choice);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(err);
      }
      options.showEndingCard(endingSlot, resolved);
    });
    choices.appendChild(button);
  }
  scene.append(title, prompt, choices, endingSlot);
  return scene;
}
