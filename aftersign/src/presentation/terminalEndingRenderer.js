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
    // The handoff starts an async restore/render path that replaces this scene.
    // Show the pending state first, then call choose on the next animation frame
    // so the pending state paints. choose is called directly; no synthetic click
    // goes to the disabled button, because browsers handle that differently.
    maudEntry.addEventListener("click", () => {
      if (maudEntry.disabled) return;
      maudEntry.disabled = true;
      maudEntry.setAttribute("data-pending", "true");
      maudEntry.setAttribute("aria-busy", "true");
      maudEntry.textContent = "Opening Bell Archive…";
      const restore = () => {
        maudEntry.disabled = false;
        maudEntry.removeAttribute("data-pending");
        maudEntry.removeAttribute("aria-busy");
        maudEntry.textContent = "Carry the name to the Bell Archive";
      };
      requestAnimationFrame(() => {
        try {
          const result = choose("carry-name-to-bell-archive");
          if (result && typeof result.catch === "function") result.catch(restore);
        } catch (error) {
          restore();
          throw error;
        }
      });
    });
    host.append(maudEntry);
  };

  const renderSaintOrraEndingRecall = () => {
    const ending = document.getElementById("episodeOneEnding")?.querySelector("[data-ending-id]");
    if (!ending) return;

    // The terminal card replaces the ordinary dialogue surface, so surface
    // the Orra line the runtime provides where the player can still read it.
    const vigilRecall = state.npcs.orra.lastLine;
    let vigilRecallNode = document.getElementById("saintOrraVigilRecall");
    if (vigilRecall) {
      if (!vigilRecallNode) {
        vigilRecallNode = document.createElement("p");
        vigilRecallNode.id = "saintOrraVigilRecall";
        ending.appendChild(vigilRecallNode);
      }
      setTextContentIfChanged(vigilRecallNode, vigilRecall);
    } else {
      vigilRecallNode?.remove();
    }

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
