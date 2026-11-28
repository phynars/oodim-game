// Terminal ending presentation. The runtime supplies mutable state and DOM handles.
export const createTerminalEndingRenderer = ({
  state,
  document,
  choose,
  setTextContentIfChanged,
  endingHideableControls,
  routeChoice,
  vigilChoice,
  offeredJobs,
  setOfferTrayVisibility,
}) => {
  const saintOrraRecallLine = () => {
    if (state.player.redTagFirstTap === "take-second-packet") {
      return "You took the red tag at once. I remember the hand that did not wait.";
    }
    if (state.player.redTagFirstTap === "ask-what-changed") {
      return "You asked what changed before you carried it. I remember the question.";
    }
    // #3123: with no first tap, a withheld-tag card must not be paired with
    // the unreconciled neutral delivery line.
    // Read the cause from story state (stamped by episodeOneEnding.js and
    // restored by persistence.js), not the DOM, so render order can't skew it.
    const endingCause = state.story.endingCause
      ?? document.getElementById("episodeOneEnding")?.querySelector("[data-ending-cause]")?.dataset.endingCause
      ?? null;
    if (endingCause === "red-tag-withheld") {
      return "You turned the tag down at the vigil, and still brought it to my door. I remember the courier.";
    }
    return "You brought the red tag to my door. I remember the courier.";
  };

  const renderMaudBellArchiveEntry = () => {
    if (
      !state.story.endingId ||
      !state.story.endingId.startsWith("ending-") ||
      !state.player.redTagDeliveredToSaintOrra ||
      !document.getElementById("saintOrraNameCase")
    ) return;
    const host = document.getElementById("episodeOneEnding");
    if (!host || host.querySelector('[data-orra-payback-action="carry-name-to-bell-archive"]')) return;
    const maudEntry = document.createElement("button");
    maudEntry.type = "button";
    maudEntry.dataset.orraPaybackAction = "carry-name-to-bell-archive";
    maudEntry.style.pointerEvents = "auto";
    maudEntry.textContent = "Carry the name to the Bell Archive";
    maudEntry.addEventListener("click", () => choose("carry-name-to-bell-archive"));
    host.append(maudEntry);
  };

  const renderSaintOrraEndingRecall = () => {
    const ending = document.getElementById("episodeOneEnding")?.querySelector("[data-ending-id]");
    if (!ending) return;
    let control = document.getElementById("carryRedTagToSaintOrra");
    let recall = document.getElementById("saintOrraRedTagRecall");
    if (state.player.redTagDeliveredToSaintOrra) {
      control?.remove();
      if (!recall) {
        recall = document.createElement("p");
        recall.id = "saintOrraRedTagRecall";
        ending.appendChild(recall);
      }
      setTextContentIfChanged(recall, saintOrraRecallLine());
      let nameCase = document.getElementById("saintOrraNameCase");
      if (!nameCase) {
        nameCase = document.createElement("p");
        nameCase.id = "saintOrraNameCase";
        nameCase.setAttribute("data-beat-id", "orra-first-name");
        ending.appendChild(nameCase);
      }
      const orraName = typeof state.player.name === "string" ? state.player.name.trim() : "";
      setTextContentIfChanged(nameCase, orraName
        ? `Saint Orra: Maud Underbell needs the name ${orraName}. Carry it sealed to the Bell Archive.`
        : "Saint Orra: Maud Underbell needs your name. Carry it sealed to the Bell Archive.");
      renderMaudBellArchiveEntry();
      return;
    }
    recall?.remove();
    document.getElementById("saintOrraNameCase")?.remove();
    if (!control) {
      control = document.createElement("button");
      control.type = "button";
      control.id = "carryRedTagToSaintOrra";
      ending.appendChild(control);
    }
    control.style.pointerEvents = "auto";
    control.setAttribute("data-choice-id", "carry-red-tag-to-saint-orra");
    setTextContentIfChanged(control, "Carry the red tag to Saint Orra");
  };

  const renderTerminalEndingControls = () => {
    // The Act III Bell Archive outcome becomes Episode 1's terminal state
    // once its Unlit Door choice is recorded. Keep its card readable while
    // removing every remaining story control; only the persistent Start
    // fresh control outside this renderer remains actionable.
    // #2904 AC-1: once the player opens the Unlit Door, the card is the
    // Unlit Door screen; earlier story controls must not stay on screen.
    const hasTerminalEpisodeEnd = Boolean(
      state.story.endingId
      || (state.story.maudBellArchiveEndingId
        && (state.story.doorChoice || state.story.maudBellArchiveDoorOpen === true)),
    );
    if (hasTerminalEpisodeEnd) {
      for (const node of endingHideableControls()) {
        if (!node.hidden) {
          node.hidden = true;
          node.dataset.endingHidden = "true";
        }
      }
      routeChoice.dataset.visible = "false";
      if (vigilChoice) vigilChoice.dataset.visible = "false";
      if (offeredJobs) {
        setOfferTrayVisibility(offeredJobs, false);
        while (offeredJobs.firstChild) offeredJobs.removeChild(offeredJobs.firstChild);
      }
      for (const id of ["orraPaybackAction", "saintOrraReturnNeed", "returnToOrra"]) document.getElementById(id)?.remove();
      return true;
    }
    for (const node of endingHideableControls()) {
      if (node.dataset.endingHidden === "true") {
        node.hidden = false;
        delete node.dataset.endingHidden;
      }
    }
    return false;
  };

  return { renderMaudBellArchiveEntry, renderSaintOrraEndingRecall, renderTerminalEndingControls };
};
