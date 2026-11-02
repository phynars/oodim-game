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

/** Render Maud's name-selection beat into a supplied scene host. */
export const renderMaudBellArchive = (doc, { storedName, onSelect } = {}) => {
  if (!doc || typeof doc.createElement !== "function") return null;
  const host = doc.getElementById("episodeOneEnding") || doc.getElementById("line");
  if (!host) return null;

  const card = doc.createElement("section");
  card.className = "episode-one-ending maud-bell-archive";
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

  for (const choice of maudBellArchiveChoices(storedName)) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "choice maud-bell-archive__choice";
    button.textContent = choice.name;
    button.setAttribute("data-maud-name-choice", choice.id);
    button.addEventListener("click", () => {
      choices.querySelectorAll("button").forEach((item) => {
        item.removeAttribute("data-selected");
        item.setAttribute("aria-pressed", "false");
      });
      button.setAttribute("data-selected", "true");
      button.setAttribute("aria-pressed", "true");
      if (typeof onSelect === "function") onSelect(choice);
    });
    choices.appendChild(button);
  }
  card.append(title, dialogue, choices);
  host.replaceChildren(card);
  return card;
};
