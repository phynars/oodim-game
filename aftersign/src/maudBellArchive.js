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

export const maudBellArchiveEndingForChoice = (choice) => {
  const name = cleanName(choice?.name);
  const nameLine = ` The bell rings for ${name}.`;
  return choice?.matchesMemory
    ? {
        id: "maud-bell-archive-lit",
        light: "lit",
        name,
        line: `The district light stays lit.${nameLine}`,
        dialogue: `Maud records ${name}. The archive rests.`,
        doorDialogue: `Maud: ${name} was rung to keep this district lit. Mara Vell pays by carrying the darkness elsewhere.`,
      }
    : {
        id: "maud-bell-archive-dark",
        light: "out",
        name,
        line: `One district light goes out.${nameLine}`,
        dialogue: `Maud records ${name}. The archive closes.`,
        doorDialogue: `Maud: ${name} was rung to close this archive. Orra Bell pays with this district's light.`,
      };
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

export const renderMaudBellArchiveEnding = (
  doc,
  host,
  endingOrChoice,
  { onOpenDoor, onChooseDoor, onBeginEpisodeTwo, doorOpen = false, doorChoice = null, ioFinalDialogue = null } = {},
) => {
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
  const title = doc.createElement("h2");
  title.textContent = doorOpen && !doorChoice ? "The Unlit Door" : doorChoice ? "Episode 1 has ended" : "Act II — Bell Archive";
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
  const door = doc.createElement("button");
  door.type = "button";
  door.className = "maud-bell-archive__unlit-door";
  door.setAttribute("data-choice-id", "open-unlit-door");
  door.textContent = "Go to the Unlit Door";
  door.style.pointerEvents = "auto";
  const doorChoices = [
    { id: "keep-official-record", label: "Keep the official record", consequence: `Record ${ending.name} in the official archive; Maud carries the district's darkness.` },
    { id: "protect-private-lie", label: "Protect the private lie", consequence: `Place a false name in ${ending.name}'s record and seal the true one away; Maud loses the district light.` },
    { id: "hang-new-sign", label: "Hang a new sign", consequence: `Replace ${ending.name}'s record with a new sign; Maud bears its false name.` },
  ];
  const showDoorChoices = () => {
    title.textContent = doorChoice ? "Episode 1 has ended" : "The Unlit Door";
    dialogue.textContent = ending.doorDialogue;
    card.setAttribute("data-unlit-door-open", "true");
    door.remove();
    if (doorChoice) {
      card.setAttribute("data-door-choice", doorChoice);
      const selected = doorChoices.find((choice) => choice.id === doorChoice);
      // Saved doorChoice values are always one of the three door ids; an
      // unknown value renders no completion line rather than invented copy.
      const completion = selected ? doc.createElement("p") : null;
      if (completion) {
        completion.className = "episode-one-completion__choice";
        completion.textContent = `You chose: ${selected.label}. ${selected.consequence}`;
      }
      if (ioFinalDialogue) {
        const finalLine = doc.createElement("p");
        finalLine.className = "maud-bell-archive__io-final";
        finalLine.setAttribute("data-io-final-id", ioFinalDialogue.id);
        finalLine.textContent = ioFinalDialogue.text;
        light.after(finalLine);
        if (completion) finalLine.after(completion);
      } else if (completion) {
        light.after(completion);
      }
      if (typeof onBeginEpisodeTwo === "function") {
        const continuation = doc.createElement("p");
        continuation.className = "episode-one-completion__continuation";
        continuation.textContent = "Episode 1 complete. Episode 2 is ready.";
        const beginEpisodeTwo = doc.createElement("button");
        beginEpisodeTwo.type = "button";
        beginEpisodeTwo.id = "beginEpisodeTwo";
        beginEpisodeTwo.textContent = "Begin Episode 2";
        beginEpisodeTwo.style.pointerEvents = "auto";
        beginEpisodeTwo.style.minHeight = "56px";
        beginEpisodeTwo.style.fontSize = "1.1rem";
        beginEpisodeTwo.style.fontWeight = "700";
        beginEpisodeTwo.addEventListener("click", onBeginEpisodeTwo);
        card.append(continuation, beginEpisodeTwo);
      }
      return;
    }
    // PR #2880 F3: one compact row in the slot the door button vacated, so
    // the card (through its district-light line) still fits the HUD panel
    // without a swipe (#2824).
    const choices = doc.createElement("div");
    choices.className = "maud-bell-archive__door-choices";
    choices.style.display = "grid";
    choices.style.gap = "4px";
    choices.style.marginTop = "4px";
    for (const choice of doorChoices) {
      const pair = doc.createElement("div");
      const button = doc.createElement("button");
      button.type = "button";
      button.setAttribute("data-choice-id", choice.id);
      button.textContent = choice.label;
      button.style.pointerEvents = "auto";
      button.style.minHeight = "44px";
      button.style.padding = "2px 4px";
      button.style.fontSize = "12px";
      button.style.lineHeight = "1.15";
      button.addEventListener("click", () => onChooseDoor?.(choice.id));
      const consequence = doc.createElement("p");
      consequence.className = "maud-bell-archive__door-consequence";
      consequence.textContent = choice.consequence;
      consequence.style.margin = "0";
      consequence.style.fontSize = "11px";
      pair.append(button, consequence);
      choices.append(pair);
    }
    light.after(choices);
    pinCardInPanel(card);
  };
  door.addEventListener("click", () => {
    onOpenDoor?.();
    showDoorChoices();
  });
  card.append(title, bell, outcome, dialogue, light, door);
  // A restored save whose door was already opened shows Maud's door line
  // and either the unselected choices or its committed receipt.
  if (doorOpen) showDoorChoices();
  host.replaceChildren(card);
  ringBell(doc, bell);
  // #2870/#2941: pin the bounded `.hud .panel` so the card shows through
  // its last row (final light line / Begin Episode 2) without a swipe,
  // but never past the card's own heading. The card has no inner
  // scrollport, so nothing below the panel can clip it.
  pinCardInPanel(card);
  return card;
};

// Scroll the nearest `.panel` ancestor so the card's bottom edge sits at
// the panel's bottom edge, clamped so the card's top never goes above the
// panel's top. Falls back to scrollIntoView when there is no panel.
const pinCardInPanel = (card) => {
  if (!card || !card.isConnected) return;
  const panel = typeof card.closest === "function" ? card.closest(".panel") : null;
  if (!panel || typeof panel.getBoundingClientRect !== "function" || typeof card.getBoundingClientRect !== "function") {
    if (typeof card.scrollIntoView === "function") card.scrollIntoView({ block: "nearest", inline: "nearest" });
    return;
  }
  const panelRect = panel.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const toBottom = cardRect.bottom - panelRect.bottom;
  const toTop = cardRect.top - panelRect.top;
  const delta = Math.min(toBottom, toTop);
  if (toBottom > 0 || toTop < 0) panel.scrollTop += delta;
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
export const renderMaudBellArchive = (
  doc,
  { storedName, endingId, endingName, doorOpen = false, doorChoice = null, ioFinalDialogue = null, onSelect, onOpenDoor, onChooseDoor, onBeginEpisodeTwo } = {},
) => {
  if (!doc || typeof doc.createElement !== "function") return null;
  const host = doc.getElementById("episodeOneEnding") || doc.getElementById("line");
  if (!host) return null;

  // #2754: a restored ending shows the name the player chose, not the
  // fallback. Legacy saves without a saved name fall back to the stored
  // player name for the lit ending (that IS the remembered name).
  const restoredBase = maudBellArchiveEndingForId(endingId);
  const restoredEnding = restoredBase
    ? maudBellArchiveEndingForChoice({
        name: endingName || (restoredBase.light === "lit" ? storedName : undefined),
        matchesMemory: restoredBase.light === "lit",
      })
    : null;
  if (restoredEnding) {
    return renderMaudBellArchiveEnding(doc, host, restoredEnding, {
      onOpenDoor,
      onChooseDoor,
      onBeginEpisodeTwo,
      doorOpen,
      doorChoice,
      ioFinalDialogue,
    });
  }

  // The scene module owns the choice UI and outcome; this wrapper maps the
  // outcome onto the ending card and delegates persistence to onSelect.
  // The card renders only after the promise onSelect returns has settled.
  const endingFor = (resolved) =>
    maudBellArchiveEndingForChoice({
      name: resolved.selectedName,
      matchesMemory: resolved.outcome === "matched",
    });
  const card = renderBellArchiveScene(doc, {
    sealedName: cleanName(storedName),
    persistOutcome: (resolved, choice) => {
      if (typeof onSelect !== "function") return undefined;
      const resolvedChoice = { ...choice, matchesMemory: resolved.outcome === "matched" };
      return onSelect(resolvedChoice, endingFor(resolved));
    },
    showEndingCard: (slot, resolved) => {
      // PR #2880 F1: forward the door-choice handler on the fresh-ending
      // path too, not only on restore, so a player who just picked the name
      // can commit a door choice with one tap.
      renderMaudBellArchiveEnding(doc, slot, endingFor(resolved), { onOpenDoor, onChooseDoor });
    },
  });
  host.replaceChildren(card);
  return card;
};
