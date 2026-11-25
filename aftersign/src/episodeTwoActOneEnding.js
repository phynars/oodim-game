import { episodeTwoJobForStory } from "./episodeTwoJobs.js";

const ANSWER_COPY = Object.freeze({
  take: "Niko: You took the shortcut. I kept the registry clerk looking the other way—once.",
  refuse: "Niko: You refused the shortcut. The long way cost time, but not your name.",
});

export const resolveEpisodeTwoActOneEnding = ({ story, delivery } = {}) => {
  const job = episodeTwoJobForStory(story);
  const answer = story?.nikoShortcutAnswer;
  if (
    !job
    || story?.episodeTwoAcceptedJobId !== job.id
    || delivery?.id !== job.deliveryId
    || !ANSWER_COPY[answer]
  ) return null;
  return Object.freeze({
    id: "episode-two-act-one",
    jobName: job.name,
    answer,
    answerLine: ANSWER_COPY[answer],
  });
};

// #3032 — stable beat ids that durably mark the Act II opening after the
// player taps Continue to Act II from the Act I ending card. Persistence
// stores `state.scene.beat`, and `restoreFlagshipBeat` passes unlisted beat
// ids through, so these survive reload without a new migration entry.
export const ACT_TWO_OPENING_BEATS = Object.freeze({
  take: "episode-two-act-two-take-opening",
  refuse: "episode-two-act-two-refuse-opening",
});

const ACT_TWO_OPENING_COPY = Object.freeze({
  take: "Act II — The clerk's lamp stays lit. Niko's shortcut bought you one quiet door.",
  refuse: "Act II — The long way is still under your shoes. Niko lets your name arrive before you do.",
});

export const ACT_TWO_OPENING_CONTINUATION = "episode-two-act-two-opening";

/**
 * Resolves the Act II opening that the current beat + story should render.
 * The beat is the source of truth: the stable Act II beat id decides that
 * an opening renders, and `story.nikoShortcutAnswer` decides which one.
 */
export const actTwoOpeningForStory = ({ beat, story } = {}) => {
  const answer = story?.nikoShortcutAnswer;
  if (beat !== ACT_TWO_OPENING_BEATS[answer]) return null;
  return Object.freeze({ id: beat, answer, copy: ACT_TWO_OPENING_COPY[answer] });
};

export const renderEpisodeTwoActTwoOpening = (doc, opening) => {
  const host = doc?.getElementById("episodeOneEnding");
  if (!host || !opening) return null;
  // Called once per frame by lineForBeat — keep the rendered card stable so
  // repeated calls don't detach it between the current frame and the next.
  const existing = host.querySelector?.(`[data-act-two-opening-id="${opening.id}"]`);
  if (existing) return existing;
  host.replaceChildren();
  host.setAttribute("data-continuation", ACT_TWO_OPENING_CONTINUATION);
  const card = doc.createElement("section");
  card.setAttribute("data-act-two-opening-id", opening.id);
  card.setAttribute("data-niko-shortcut-answer", opening.answer);
  const title = doc.createElement("strong");
  title.textContent = "Episode 2 — Act II";
  const copy = doc.createElement("p");
  copy.textContent = opening.copy;
  card.append(title, copy);
  host.append(card);
  doc.getElementById("line")?.replaceChildren();
  return card;
};

export const renderEpisodeTwoActOneEnding = (doc, ending, onContinue) => {
  if (!doc || !ending) return null;
  const host = doc.getElementById("episodeOneEnding");
  if (!host) return null;
  // Once the player has advanced to the Act II opening, keep that card
  // across the per-frame lineForBeat rebuild attempts.
  if (host.getAttribute?.("data-continuation") === ACT_TWO_OPENING_CONTINUATION) {
    return host.querySelector?.("[data-act-two-opening-id]") ?? host;
  }
  const existing = host.querySelector?.(`[data-ending-id="${ending.id}"]`);
  if (existing) return existing;
  host.replaceChildren();
  host.setAttribute("data-continuation", "episode-two-act-one-ending");
  const card = doc.createElement("section");
  card.className = "episode-two-act-one-ending";
  card.setAttribute("data-ending-id", ending.id);
  card.setAttribute("data-episode-two-job", ending.jobName);
  card.setAttribute("data-niko-shortcut-answer", ending.answer);
  card.setAttribute("data-niko-shortcut-selected", "true");
  const title = doc.createElement("strong");
  title.textContent = "Episode 2 — Act I";
  const job = doc.createElement("p");
  job.textContent = `Carried: ${ending.jobName}.`;
  const answer = doc.createElement("p");
  answer.textContent = ending.answerLine;
  answer.setAttribute("data-npc", "niko-thread");
  const continueButton = doc.createElement("button");
  continueButton.type = "button";
  continueButton.textContent = "Continue to Act II";
  continueButton.setAttribute("data-episode-two-next-step", "act-two-continuation");
  continueButton.style.pointerEvents = "auto";
  continueButton.style.minHeight = "44px";
  continueButton.addEventListener("click", () => onContinue?.());
  card.append(title, job, answer, continueButton);
  host.append(card);
  const line = doc.getElementById("line");
  line?.replaceChildren();
  return card;
};
