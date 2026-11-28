import { NIKO_SHORTCUT_CHOICES, nikoRouteLine, nikoShortcutReceipt } from "./nikoThread.js";

/**
 * Renders the Night Post slice from durable-state snapshots. Runtime state and
 * persistence remain the caller's responsibility through the callbacks.
 */
export const renderNightPost = ({
  doc,
  host,
  doorChoice,
  doorLabel,
  job,
  acceptedJobId,
  nikoShortcutAnswer,
  routeRisk,
  routeRiskDeliveryId,
  onAcceptJob,
  onChooseShortcut,
}) => {
  if (!host || host.getAttribute("data-continuation") === "night-post") return;

  host.replaceChildren();
  host.setAttribute("data-continuation", "night-post");
  const heading = doc.createElement("strong");
  heading.textContent = "Night Post";
  // #3125: Io's dialogue line (#line) already says "I remember the door you
  // chose: …". Keep the door choice as a data hook here, not as a second copy
  // of that sentence.
  heading.setAttribute("data-night-post-door-choice", doorChoice ?? "");
  heading.setAttribute("data-night-post-door-label", doorLabel ?? "");
  host.append(heading);
  if (!job) return;

  const accepted = acceptedJobId === job.id;
  const jobCard = doc.createElement("section");
  jobCard.id = "episodeTwoJob";
  jobCard.setAttribute("data-episode-two-job-id", job.id);
  jobCard.setAttribute("data-episode-two-door-choice", job.doorChoice);
  const jobName = doc.createElement("strong");
  jobName.textContent = job.name;
  const jobBrief = doc.createElement("p");
  jobBrief.textContent = job.brief;
  const offer = doc.createElement("p");
  offer.className = "episode-two-job__io-offer";
  offer.textContent = "Io: This is the work the door left for you.";
  const accept = doc.createElement("button");
  accept.type = "button";
  accept.id = "acceptEpisodeTwoJob";
  accept.textContent = `Accept ${job.name}`;
  accept.style.pointerEvents = "auto";
  accept.style.minHeight = "44px";
  accept.disabled = accepted;
  if (accepted) {
    accept.textContent = "Accepted";
    jobCard.setAttribute("data-episode-two-delivery-id", job.deliveryId);
    jobCard.setAttribute("data-episode-two-accepted-job-id", job.id);
  }
  accept.addEventListener("click", async () => {
    if (accept.disabled) return;
    accept.disabled = true;
    accept.setAttribute("data-pending", "true");
    accept.setAttribute("aria-busy", "true");
    accept.textContent = "Accepting…";
    await onAcceptJob(job);
    const choices = doc.getElementById("nikoThread")?.querySelectorAll("[data-niko-shortcut-choice]") ?? [];
    const lastChoice = choices[choices.length - 1];
    if (lastChoice && typeof lastChoice.scrollIntoView === "function") {
      lastChoice.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  });
  jobCard.append(jobName, jobBrief, offer, accept);

  const route = routeRisk?.lastRoute === "safe" ? "safe" : routeRisk?.lastRoute === "fast" ? "risky" : "none";
  if (!accepted) {
    const greeting = doc.createElement("section");
    greeting.id = "nikoThread";
    greeting.setAttribute("data-npc", "niko-thread");
    greeting.setAttribute("data-niko-greeting", "night-post");
    const line = doc.createElement("p");
    line.setAttribute("data-niko-route", route);
    line.textContent = nikoRouteLine(routeRisk, routeRiskDeliveryId);
    greeting.append(line);
    host.append(greeting, jobCard);
    return;
  }

  host.append(jobCard);
  const nikoCard = doc.createElement("section");
  nikoCard.id = "nikoThread";
  nikoCard.setAttribute("data-npc", "niko-thread");
  const routeLine = doc.createElement("p");
  routeLine.setAttribute("data-niko-route", route);
  routeLine.textContent = nikoRouteLine(routeRisk, routeRiskDeliveryId);
  nikoCard.append(routeLine);
  const shortcutExplanation = doc.createElement("p");
  shortcutExplanation.setAttribute("data-niko-shortcut-explanation", "true");
  shortcutExplanation.textContent = "Niko offers a quicker route to the Night Post registry; taking it changes how you arrive.";
  nikoCard.append(shortcutExplanation);
  const receipt = nikoShortcutReceipt(nikoShortcutAnswer);
  if (receipt) {
    const answerLine = doc.createElement("p");
    answerLine.setAttribute("data-niko-shortcut-answer", nikoShortcutAnswer);
    answerLine.textContent = receipt;
    nikoCard.append(answerLine);
  }
  for (const [answerId, label] of [[NIKO_SHORTCUT_CHOICES.TAKE, "Take the shortcut"], [NIKO_SHORTCUT_CHOICES.REFUSE, "Refuse the shortcut"]]) {
    const choice = doc.createElement("button");
    choice.type = "button";
    choice.textContent = label;
    choice.setAttribute("data-niko-shortcut-choice", answerId);
    choice.setAttribute("aria-pressed", String(nikoShortcutAnswer === answerId));
    if (nikoShortcutAnswer === answerId) choice.setAttribute("data-niko-shortcut-selected", "true");
    choice.style.pointerEvents = "auto";
    choice.style.minHeight = "44px";
    choice.disabled = Boolean(nikoShortcutAnswer);
    choice.addEventListener("click", async () => {
      if (!choice.disabled) await onChooseShortcut(answerId);
    });
    nikoCard.append(choice);
  }
  host.append(nikoCard);
};
