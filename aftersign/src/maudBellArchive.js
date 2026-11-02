// Maud Underbell's Bell Archive beat.
// Selection remains local to this scene until a later phase makes it durable.

const cleanName = (value) => {
  const name = typeof value === "string" ? value.trim() : "";
  return name || "the courier";
};

export const maudBellArchiveChoices = (storedName) => {
  const rememberedName = cleanName(storedName);
  return [
    { id: "remembered-name", name: rememberedName, matchesMemory: true },
    { id: "archive-decoy", name: "Mara Vell", matchesMemory: false },
    { id: "archive-decoy-second", name: "Orra Bell", matchesMemory: false },
  ];
};

// Class names are passed as separate tokens so no space-joined literal
// is mistaken for player copy by scripts/served-reach.mjs.
const addClasses = (el, ...names) => {
  if (el.classList && typeof el.classList.add === "function") el.classList.add(...names);
  else el.className = names.join(" ");
};

const endingForChoice = (choice) =>
  choice.matchesMemory
    ? {
        id: "maud-bell-archive-lit",
        light: "lit",
        line: "The bell remembers the name. The district light stays lit.",
        dialogue: "Io records the true name. Orra hears the bell answer. Maud lets the archive rest.",
      }
    : {
        id: "maud-bell-archive-dark",
        light: "out",
        line: "The bell answers the wrong name. One district light goes out.",
        dialogue: "Io records the miss. Orra hears the silence. Maud closes the archive.",
      };

const renderEnding = (doc, host, choice) => {
  const ending = endingForChoice(choice);
  const card = doc.createElement("section");
  addClasses(card, "episode-one-ending", "maud-bell-archive__ending", `maud-bell-archive__ending--${ending.light}`);
  card.setAttribute("data-ending-id", ending.id);
  card.setAttribute("data-district-light", ending.light);
  card.setAttribute("data-bell-ringing", "true");
  card.style.pointerEvents = "auto";

  const title = doc.createElement("strong");
  title.textContent = "Act II — Bell Archive";
  const bell = doc.createElement("p");
  bell.className = "episode-one-ending__bell";
  bell.textContent = "The Bell Archive rings.";
  const outcome = doc.createElement("p");
  outcome.className = "episode-one-ending__outcome";
  outcome.textContent = ending.line;
  const dialogue = doc.createElement("p");
  dialogue.className = "episode-one-ending__recall";
  dialogue.textContent = ending.dialogue;
  const light = doc.createElement("p");
  light.className = "episode-one-ending__light";
  light.setAttribute("data-district-light", ending.light);
  light.textContent = ending.light === "lit" ? "District light: lit" : "District light: out";
  card.append(title, bell, outcome, dialogue, light);
  host.replaceChildren(card);
  ringBell(doc, bell);
  return card;
};

// Bell ring: a short WAAPI swing on the bell line. Skipped when the
// player prefers reduced motion or the runtime has no Element.animate.
const ringBell = (doc, bell) => {
  if (!bell || typeof bell.animate !== "function") return;
  const view = doc.defaultView;
  const reduced =
    !!view &&
    typeof view.matchMedia === "function" &&
    view.matchMedia("(prefers-reduced-motion:reduce)").matches;
  if (reduced) return;
  bell.animate(
    [
      { transform: "rotate(0deg)" },
      { transform: "rotate(-8deg)" },
      { transform: "rotate(6deg)" },
      { transform: "rotate(-3deg)" },
      { transform: "rotate(0deg)" },
    ],
    { duration: 600, easing: "ease-out" },
  );
};

/** Render Maud's name-selection beat into a supplied scene host. */
export const renderMaudBellArchive = (doc, { storedName, completedChoiceId, onSelect } = {}) => {
  if (!doc || typeof doc.createElement !== "function") return null;
  const host = doc.getElementById("episodeOneEnding") || doc.getElementById("line");
  if (!host) return null;
  const choicesForName = maudBellArchiveChoices(storedName);
  const completedChoice = choicesForName.find((choice) => choice.id === completedChoiceId);
  if (completedChoice) {
    // Idempotent restore: lineForBeat calls this every tick, so keep an
    // already-rendered matching card instead of rebuilding it (and
    // re-ringing the bell) on each frame.
    const existing = host.firstElementChild;
    // During live play the tapped choice card stays up (its ending slot
    // already shows the result, and re-selection must keep working), so
    // never swap it out for the restore card mid-session.
    if (
      !onSelect &&
      existing &&
      existing.getAttribute &&
      existing.getAttribute("data-beat") === "maud-bell-archive"
    ) {
      return existing;
    }
    if (
      existing &&
      existing.getAttribute &&
      existing.getAttribute("data-ending-id") === endingForChoice(completedChoice).id
    ) {
      return existing;
    }
    return renderEnding(doc, host, completedChoice);
  }

  const card = doc.createElement("section");
  addClasses(card, "episode-one-ending", "maud-bell-archive");
  card.setAttribute("data-beat", "maud-bell-archive");
  // The host sits under `.hud` (pointer-events: none); opt the card back in
  // so name taps reach the buttons instead of the canvas. Mirrors the
  // `#episodeOneEnding .maud-bell-archive` rule in index.html.
  card.style.pointerEvents = "auto";
  const title = doc.createElement("strong");
  title.textContent = "Maud Underbell — Bell Archive";
  const dialogue = doc.createElement("p");
  dialogue.className = "episode-one-ending__bell";
  dialogue.textContent = "Maud opens the archive. Which name did the bell keep?";
  const choices = doc.createElement("div");
  choices.className = "maud-bell-archive__choices";
  const endingSlot = doc.createElement("div");
  endingSlot.className = "maud-bell-archive__ending-slot";
  endingSlot.setAttribute("aria-live", "polite");

  for (const choice of choicesForName) {
    const button = doc.createElement("button");
    button.type = "button";
    addClasses(button, "choice", "maud-bell-archive__choice");
    button.textContent = choice.name;
    button.setAttribute("data-maud-name-choice", choice.id);
    button.addEventListener("click", async () => {
      choices.querySelectorAll("button").forEach((item) => {
        item.removeAttribute("data-selected");
        item.setAttribute("aria-pressed", "false");
      });
      button.setAttribute("data-selected", "true");
      button.setAttribute("aria-pressed", "true");
      try {
        if (typeof onSelect === "function") await onSelect(choice);
        renderEnding(doc, endingSlot, choice);
      } catch {
        // A failed save must not produce a completed result (design #2598
        // failure handling), but the player has to see why nothing rang:
        // keep the choices tappable and say so in the live ending slot.
        button.removeAttribute("data-selected");
        button.setAttribute("aria-pressed", "false");
        endingSlot.textContent = "";
        const failure = doc.createElement("p");
        failure.className = "maud-bell-archive__save-failure";
        failure.setAttribute("role", "alert");
        failure.setAttribute("data-maud-save-failed", "true");
        failure.textContent = "The archive ledger didn't take the name. Try again.";
        endingSlot.appendChild(failure);
      }
    });
    choices.appendChild(button);
  }
  card.append(title, dialogue, choices, endingSlot);
  host.replaceChildren(card);
  return card;
};
