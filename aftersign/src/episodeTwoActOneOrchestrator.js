import { episodeTwoJobForStory } from "./episodeTwoJobs.js";
import {
  renderEpisodeTwoActOneEnding,
  renderEpisodeTwoCurrentContent,
  resolveEpisodeTwoActOneEnding,
} from "./episodeTwoActOneEnding.js";

/**
 * Coordinates the Episode 2 Act I story state without owning page state or
 * player-visible copy. Callers provide the state dependencies explicitly.
 */
export const resolveEpisodeTwoActOneOrchestration = ({ story, delivery } = {}) =>
  Object.freeze({
    job: episodeTwoJobForStory(story),
    ending: resolveEpisodeTwoActOneEnding({ story, delivery }),
  });

/**
 * Renders the resolved Act I ending and advances to its existing continuation.
 */
export const renderEpisodeTwoActOneOrchestration = ({ doc, ending, onRendered } = {}) => {
  if (!doc || !ending) return null;
  return renderEpisodeTwoActOneEnding(doc, ending, () => {
    renderEpisodeTwoCurrentContent(doc);
    onRendered?.();
  });
};
