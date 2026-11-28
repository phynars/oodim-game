/**
 * Chooses the dialogue branch from explicit story facts. Rendering and state
 * changes stay with main.js, so this module has no DOM dependency.
 */
export const selectDialogueBranch = ({ episodeTwoActOne, story }) => {
  if (episodeTwoActOne.actTwoOpening) return { kind: "act-two-opening" };
  if (story.episodeTwoActOneEnded && episodeTwoActOne.ending) return { kind: "act-one-ending" };
  if (story.maudBellArchiveEndingId) return { kind: "maud-ending" };
  if (story.endingId) return { kind: "episode-one-ending" };
  return { kind: "io" };
};
