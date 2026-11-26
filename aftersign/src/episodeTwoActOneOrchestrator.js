import { episodeTwoJobForStory } from "./episodeTwoJobs.js";
import {
  ACT_TWO_OPENING_BEATS,
  actTwoOpeningForStory,
  renderEpisodeTwoActOneEnding,
  renderEpisodeTwoActTwoOpening,
  resolveEpisodeTwoActOneEnding,
} from "./episodeTwoActOneEnding.js";

export { ACT_TWO_OPENING_BEATS };

/**
 * Coordinates the Episode 2 Act I story state without owning page state or
 * player-visible copy. Callers provide the state dependencies explicitly.
 *
 * Resolves three sibling facts:
 *   - `job`           — the Episode 2 job the door choice mapped to.
 *   - `ending`        — the Act I ending card the player has just earned.
 *   - `actTwoOpening` — the Act II opening the current beat says to render,
 *                       or `null` when no Act II beat is persisted yet.
 */
export const resolveEpisodeTwoActOneOrchestration = ({ beat, story, delivery } = {}) =>
  Object.freeze({
    job: episodeTwoJobForStory(story),
    ending: resolveEpisodeTwoActOneEnding({ story, delivery }),
    actTwoOpening: actTwoOpeningForStory({ beat, story }),
  });

/**
 * Renders either the Act II opening (when its beat is active) or the Act I
 * ending with its "Continue to Act II" control. The caller passes
 * `onContinueToActTwo` which must set `state.scene.beat` to the Act II beat
 * matching the player's Niko answer, persist, and re-render — this orchestrator
 * stays out of beat / persistence ownership.
 */
export const renderEpisodeTwoActOneOrchestration = (
  { doc, ending, actTwoOpening, onContinueToActTwo, onUnaddressedChildAnswer, onRendered } = {},
) => {
  if (!doc) return null;
  if (actTwoOpening) {
    const opening = renderEpisodeTwoActTwoOpening(doc, actTwoOpening, onUnaddressedChildAnswer);
    if (opening) onRendered?.();
    return opening;
  }
  if (!ending) return null;
  const card = renderEpisodeTwoActOneEnding(doc, ending, () => {
    onContinueToActTwo?.();
  });
  if (card) onRendered?.();
  return card;
};
