import { episodeTwoJobForStory } from "./episodeTwoJobs.js";

const ANSWER_COPY = Object.freeze({
  take: "You took Niko's shortcut.",
  refuse: "You refused Niko's shortcut.",
});

export const resolveEpisodeTwoActOneEnding = ({ story, delivery } = {}) => {
  const job = episodeTwoJobForStory(story);
  const answer = story?.nikoShortcutAnswer;
  if (!job || delivery?.id !== job.deliveryId || !ANSWER_COPY[answer]) return null;
  return Object.freeze({
    id: "episode-two-act-one",
    jobName: job.name,
    answer,
    answerLine: ANSWER_COPY[answer],
  });
};

export const renderEpisodeTwoActOneEnding = (doc, ending) => {
  if (!doc || !ending) return null;
  const host = doc.getElementById("episodeOneEnding");
  if (!host) return null;
  const existing = host.querySelector?.(`[data-ending-id="${ending.id}"]`);
  if (existing) return existing;
  host.replaceChildren();
  host.setAttribute("data-continuation", "episode-two-act-one-ending");
  const card = doc.createElement("section");
  card.className = "episode-two-act-one-ending";
  card.setAttribute("data-ending-id", ending.id);
  card.setAttribute("data-episode-two-job", ending.jobName);
  card.setAttribute("data-niko-shortcut-answer", ending.answer);
  const title = doc.createElement("strong");
  title.textContent = "Episode 2 — Act I";
  const job = doc.createElement("p");
  job.textContent = `Carried: ${ending.jobName}.`;
  const answer = doc.createElement("p");
  answer.textContent = ending.answerLine;
  card.append(title, job, answer);
  host.append(card);
  const line = doc.getElementById("line");
  line?.replaceChildren();
  return card;
};
