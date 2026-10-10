// Episode 1 ending resolver + served-page renderer.
//
// Single source of truth for the two M3-E1 endings (issue #2261):
//   true  — the Bell Archive rings Saint Orra's name true (player kept
//           the blue packet SEALED and carried the red tag through to
//           Orra's hand). District light stays LIT.
//   false — the bell rings the wrong name; the withheld red tag means
//           the archive had to guess who the dark belonged to. South
//           district light goes OUT.
//
// Both outcomes cite CONCRETE prior actions (the sealed/opened blue
// packet, the carried/withheld red tag) — never a generic affinity
// line (issue #2261's narrative rule).

export const EPISODE_ONE_ENDINGS = Object.freeze({
  true: Object.freeze({
    id: "ending-bell-true",
    light: "lit",
    bellLine: "The Bell Archive rings Saint Orra's true name.",
    ioLine:
      "You kept the blue packet sealed. I kept that clean handoff beside Orra's name.",
    line: "The Bell Archive rings Orra's name true. Io keeps the blue packet sealed in the record.",
  }),
  false: Object.freeze({
    id: "ending-light-out",
    light: "out",
    bellLine: "The Bell Archive rings for the wrong name.",
    ioLine:
      "You withheld the red tag. The archive had to guess who the dark belonged to.",
    line: "The Bell Archive rings the wrong name. The red tag was withheld, and the district light goes out.",
  }),
});

// Preserved shim for any pre-existing caller that keyed on packet-seal
// alone. New consumers should call `resolveEpisodeOneEnding(...)`.
export const episodeOneEndingForPacket = (sealed) =>
  sealed ? EPISODE_ONE_ENDINGS.true : EPISODE_ONE_ENDINGS.false;

/**
 * Pick the Episode 1 ending for a run.
 *
 * Ending-true requires BOTH concrete prior actions:
 *   • the blue packet is still SEALED at Orra's hand, AND
 *   • the red tag was carried (state.delivery.id === "red-tag").
 * Any other combination falls to ending-false (light goes out).
 */
export const resolveEpisodeOneEnding = ({
  packetSealed,
  redTagCarried,
} = {}) => {
  if (packetSealed && redTagCarried) {
    return EPISODE_ONE_ENDINGS.true;
  }
  return EPISODE_ONE_ENDINGS.false;
};

/**
 * Render the chosen ending card into the served page.
 *
 * The host element is `#episodeOneEnding` in `aftersign/index.html`
 * (an `aria-live="polite"` region). We replace its children with a
 * single `<section data-ending-id="…">` carrying the bell line, Io's
 * recall line, and the district-light state — the three signals the
 * consumer tests pin on.
 */
export const renderEpisodeOneEnding = (doc, ending) => {
  if (!doc || typeof doc.getElementById !== "function" || !ending) {
    return null;
  }
  const host = doc.getElementById("episodeOneEnding");
  if (!host) {
    return null;
  }
  host.replaceChildren();
  const card = doc.createElement("section");
  card.className = "episode-one-ending";
  card.setAttribute("data-ending-id", ending.id);
  const title = doc.createElement("strong");
  title.textContent = "Episode 1 — complete";
  const bell = doc.createElement("p");
  bell.className = "episode-one-ending__bell";
  bell.textContent = ending.bellLine;
  const recall = doc.createElement("p");
  recall.className = "episode-one-ending__recall";
  recall.textContent = ending.ioLine;
  const districtLight = doc.createElement("p");
  districtLight.className = "episode-one-ending__light";
  districtLight.setAttribute("data-district-light", ending.light);
  districtLight.textContent =
    ending.light === "out"
      ? "South district light: out"
      : "South district light: lit";
  card.append(title, bell, recall, districtLight);
  host.appendChild(card);
  return card;
};
