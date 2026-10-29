// Episode 1 ending resolver + served-page renderer.
//
// Single source of truth for the two M3-E1 endings. The true ending
// records only the actions the player actually took: they kept the blue
// packet sealed and accepted the red tag. It must not imply a delivery to
// Saint Orra, because the episode ends before that delivery happens.

const ENDINGS = {
  true: Object.freeze({
    id: "ending-bell-true",
    cause: "sealed-and-tagged",
    light: "lit",
    bellLine: "The Bell Archive rings Saint Orra's true name.",
    ioLine:
      "You kept the blue packet sealed. You accepted the red tag for Saint Orra.",
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
};

Object.defineProperty(ENDINGS, "false", {
  value: ENDINGS.redTagWithheld,
  enumerable: false,
  configurable: false,
  writable: false,
});
export const EPISODE_ONE_ENDINGS = Object.freeze(ENDINGS);

export const episodeOneEndingForPacket = (sealed) =>
  sealed ? EPISODE_ONE_ENDINGS.true : EPISODE_ONE_ENDINGS.packetOpened;

export const resolveEpisodeOneEnding = ({
  packetSealed,
  redTagCarried,
} = {}) => {
  if (packetSealed && redTagCarried) {
    return EPISODE_ONE_ENDINGS.true;
  }
  if (!packetSealed) {
    return EPISODE_ONE_ENDINGS.packetOpened;
  }
  return EPISODE_ONE_ENDINGS.redTagWithheld;
};

/** Render the chosen ending card into the served page. */
export const renderEpisodeOneEnding = (doc, ending) => {
  if (!doc || typeof doc.getElementById !== "function" || !ending) {
    return null;
  }
  const host = doc.getElementById("episodeOneEnding");
  if (!host) {
    return null;
  }
  const existing = host.firstElementChild;
  if (
    existing &&
    existing.getAttribute &&
    existing.getAttribute("data-ending-id") === ending.id &&
    (existing.getAttribute("data-ending-cause") ?? "") === (ending.cause ?? "")
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
  const outcome = doc.createElement("p");
  outcome.className = "episode-one-ending__outcome";
  outcome.textContent = ending.line;
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
  card.append(title, bell, outcome, recall, districtLight);
  host.appendChild(card);
  return card;
};

/** Publish the durable ending identity to the observable game surface. */
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
