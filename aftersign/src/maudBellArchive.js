// Maud Underbell's Bell Archive beat.

import { renderBellArchiveScene } from "./bellArchiveScene.ts";

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

// Markup hooks this module owns (also read by hasLiveMaudChoices).
const BEAT_ATTR = "data-beat";
const MAUD_BEAT_ID = "maud-bell-archive";
const NAME_CHOICE_ATTR = "data-maud-name-choice";

// Class names are passed as separate tokens so no space-joined literal
// is mistaken for player copy by scripts/served-reach.mjs.
const addClasses = (el, ...names) => {
  if (el.classList && typeof el.classList.add === "function") el.classList.add(...names);
  else el.className = names.join(" ");
};

export const maudBellArchiveEndingForChoice = (choice) =>
  choice?.matchesMemory
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

export const maudBellArchiveEndingForId = (endingId) => {
  if (endingId === "maud-bell-archive-lit") {
    return maudBellArchiveEndingForChoice({ matchesMemory: true });
  }
  if (endingId === "maud-bell-archive-dark") {
    return maudBellArchiveEndingForChoice({ matchesMemory: false });
  }
  return null;
};

export const renderMaudBellArchiveEnding = (doc, host, endingOrChoice) => {
  const ending = endingOrChoice?.light
    ? endingOrChoice
    : maudBellArchiveEndingForChoice(endingOrChoice);
  if (!ending || !host) return null;
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

/**
 * True while Maud's live name-choice card (rendered below) is on screen.
 * This module owns the data-beat / data-maud-name-choice markup, so callers
 * ask here instead of duplicating the selector.
 */
export const hasLiveMaudChoices = (doc) => {
  if (!doc || typeof doc.getElementById !== "function") return false;
  const host = doc.getElementById("episodeOneEnding");
  if (!host || typeof host.querySelector !== "function") return false;
  if (typeof host.querySelectorAll !== "function") return false;
  for (const card of host.querySelectorAll("section")) {
    if (card.getAttribute(BEAT_ATTR) !== MAUD_BEAT_ID) continue;
    for (const button of card.querySelectorAll("button")) {
      if (button.hasAttribute(NAME_CHOICE_ATTR)) return true;
    }
  }
  return false;
};

/** Render Maud's name-selection beat into a supplied scene host. */
export const renderMaudBellArchive = (doc, { storedName, endingId, onSelect } = {}) => {
  if (!doc || typeof doc.createElement !== "function") return null;
  const host = doc.getElementById("episodeOneEnding") || doc.getElementById("line");
  if (!host) return null;

  const restoredEnding = maudBellArchiveEndingForId(endingId);
  if (restoredEnding) return renderMaudBellArchiveEnding(doc, host, restoredEnding);

  // The scene module owns the choice UI and outcome; this wrapper maps the
  // outcome onto the ending card and delegates persistence to onSelect.
  // The card renders only after the promise onSelect returns has settled.
  const endingFor = (resolved) =>
    maudBellArchiveEndingForChoice({ matchesMemory: resolved.outcome === "matched" });
  const card = renderBellArchiveScene(doc, {
    sealedName: cleanName(storedName),
    persistOutcome: (resolved, choice) => {
      if (typeof onSelect !== "function") return undefined;
      const resolvedChoice = { ...choice, matchesMemory: resolved.outcome === "matched" };
      return onSelect(resolvedChoice, endingFor(resolved));
    },
    showEndingCard: (slot, resolved) => {
      renderMaudBellArchiveEnding(doc, slot, endingFor(resolved));
    },
  });
  host.replaceChildren(card);
  return card;
};
