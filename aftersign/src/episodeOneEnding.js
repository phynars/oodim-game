// Episode 1 ending resolver + served-page renderer.
//
// Single source of truth for the two M3-E1 endings (issue #2261):
//   true  — the Bell Archive rings Saint Orra's name true (player kept
//           the blue packet SEALED and carried the red tag through to
//           Orra's hand). District light stays LIT.
//   false — the bell rings the wrong name; some concrete prior action
//           broke the chain. South district light goes OUT.
//
// Both outcomes cite CONCRETE prior actions — never a generic affinity
// line (issue #2261's narrative rule). The false branch has TWO
// cause-specific closing lines so Io never speaks a FALSE MEMORY
// (Soren's P1 on PR #2265):
//
//   • Packet opened → "You opened the blue packet." — the archive
//     lost its name because the courier read what wasn't theirs.
//   • Packet sealed BUT red tag withheld → "You withheld the red tag."
//     — the tag never reached Saint Orra's hand.
//   • Both broken → packet-opened cause wins (it's the earlier,
//     louder commitment; the archive never got far enough to care
//     about the tag).

export const EPISODE_ONE_ENDINGS = Object.freeze({
  true: Object.freeze({
    id: "ending-bell-true",
    cause: "sealed-and-tagged",
    light: "lit",
    bellLine: "The Bell Archive rings Saint Orra's true name.",
    ioLine:
      "You kept the blue packet sealed. I kept that clean handoff beside Orra's name.",
    line: "The Bell Archive rings Orra's name true. Io keeps the blue packet sealed in the record.",
  }),
  packetOpened: Object.freeze({
    id: "ending-light-out",
    cause: "packet-opened",
    light: "out",
    bellLine: "The Bell Archive rings for the wrong name.",
    ioLine:
      "You opened the blue packet. The archive had to guess who the dark belonged to.",
    line: "The Bell Archive rings the wrong name. The blue packet was opened, and the district light goes out.",
  }),
  redTagWithheld: Object.freeze({
    id: "ending-light-out",
    cause: "red-tag-withheld",
    light: "out",
    bellLine: "The Bell Archive rings for the wrong name.",
    ioLine:
      "You withheld the red tag. The archive had to guess who the dark belonged to.",
    line: "The Bell Archive rings the wrong name. The red tag was withheld, and the district light goes out.",
  }),
});

// Back-compat alias: a prior draft of this module exposed one `false`
// ending with the red-tag line. External callers (any that import the
// `false` key by name) should move to `resolveEpisodeOneEnding` + its
// cause-branched outputs. The alias points at the red-tag variant so
// snapshot consumers that keyed on the old `false` id keep their
// shape until they migrate.
Object.defineProperty(EPISODE_ONE_ENDINGS, "false", {
  value: EPISODE_ONE_ENDINGS.redTagWithheld,
  enumerable: false,
  configurable: false,
  writable: false,
});

// Preserved shim for any pre-existing caller that keyed on packet-seal
// alone. New consumers should call `resolveEpisodeOneEnding(...)`.
// Mirrors the resolver's "sealed + tagged" rule: a sealed packet alone
// no longer rings true if the tag was dropped — the shim returns the
// red-tag-withheld variant for the unknown-tag case, which is the
// correct false memory for a caller that doesn't carry the tag axis.
export const episodeOneEndingForPacket = (sealed) =>
  sealed ? EPISODE_ONE_ENDINGS.true : EPISODE_ONE_ENDINGS.packetOpened;

/**
 * Pick the Episode 1 ending for a run.
 *
 * Ending-true requires BOTH concrete prior actions:
 *   • the blue packet is still SEALED at Orra's hand, AND
 *   • the red tag was carried (state.delivery.id === "red-tag").
 *
 * Otherwise the false ending is picked, and the SPECIFIC prior action
 * that broke the chain decides which closing line Io speaks:
 *   • packet opened → packetOpened variant
 *   • packet sealed, tag withheld → redTagWithheld variant
 * This is the fix for Soren's P1 on PR #2265: a packet-opened run
 * that still carried the red tag used to hear "You withheld the red
 * tag" — a FALSE MEMORY #2261 explicitly rules out.
 */
export const resolveEpisodeOneEnding = ({
  packetSealed,
  redTagCarried,
} = {}) => {
  if (packetSealed && redTagCarried) {
    return EPISODE_ONE_ENDINGS.true;
  }
  if (!packetSealed) {
    // Packet-opened wins over red-tag-withheld when both are true:
    // opening the packet is the earlier, louder commitment, and Io's
    // closing line should name the first thing the player did that
    // the archive could not forgive.
    return EPISODE_ONE_ENDINGS.packetOpened;
  }
  return EPISODE_ONE_ENDINGS.redTagWithheld;
};

/**
 * Render the chosen ending card into the served page.
 *
 * The host element is `#episodeOneEnding` in `aftersign/index.html`
 * (an `aria-live="polite"` region). We replace its children with a
 * single `<section data-ending-id="…">` carrying the bell line, Io's
 * recall line, and the district-light state — the three signals the
 * consumer tests pin on.
 *
 * This function is idempotent: calling it twice with the same ending
 * leaves a single card in place (the first render's children are
 * replaced, not appended). That matters for the restore path —
 * `lineForBeat()` calls this on every tick whenever
 * `state.story.endingId` is set, so a reloaded session that lands at
 * the ending beat still gets a visible card without a double render
 * stacking two cards into the HUD.
 */
export const renderEpisodeOneEnding = (doc, ending) => {
  if (!doc || typeof doc.getElementById !== "function" || !ending) {
    return null;
  }
  const host = doc.getElementById("episodeOneEnding");
  if (!host) {
    return null;
  }
  // Short-circuit when a card for the SAME ending id is already in
  // place — avoids a flicker on every render tick while
  // `state.story.endingId` is set. A different id (or no card yet)
  // falls through and renders fresh.
  const existing = host.firstElementChild;
  if (
    existing &&
    existing.getAttribute &&
    existing.getAttribute("data-ending-id") === ending.id &&
    existing.getAttribute("data-ending-cause") === (ending.cause ?? "")
  ) {
    return existing;
  }
  host.replaceChildren();
  const card = doc.createElement("section");
  card.className = "episode-one-ending";
  card.setAttribute("data-ending-id", ending.id);
  if (ending.cause) {
    card.setAttribute("data-ending-cause", ending.cause);
  }
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

/**
 * Stamp `story.endingId` onto `window.__game` so a tap-driven e2e can
 * assert the shipped ending by id without reaching into DOM text.
 *
 * `aftersign/main.js` builds `window.__game` from a `publishState()`
 * function this module never sees; rather than reach across that
 * seam, we project `state.story.endingId` onto the live surface
 * directly. The write is defensive — a missing `window.__game` or a
 * missing `story` sub-object is treated as "surface not up yet", and
 * the function is a no-op. Called from `choose()` after the ending
 * resolves AND from `lineForBeat()`'s ending branch, so a reloaded
 * run also publishes the field as soon as the beat is spoken.
 */
export const publishEpisodeOneEndingToWindowGame = (win, ending) => {
  if (!win || !ending || !ending.id) {
    return false;
  }
  const game = win.__game;
  if (!game || typeof game !== "object") {
    return false;
  }
  const story =
    game.story && typeof game.story === "object" ? game.story : {};
  story.endingId = ending.id;
  story.endingCause = ending.cause ?? null;
  if (!game.story) {
    game.story = story;
  }
  return true;
};
