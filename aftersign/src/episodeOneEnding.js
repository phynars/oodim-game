export const EPISODE_ONE_ENDINGS = Object.freeze({
  true: Object.freeze({
    id: "ending-bell-true",
    light: "lit",
    line: "The Bell Archive rings Orra's name true. Io keeps the blue packet sealed in the record.",
  }),
  false: Object.freeze({
    id: "ending-light-out",
    light: "out",
    line: "The Bell Archive rings the wrong name. The red tag was withheld, and the district light goes out.",
  }),
});

export const episodeOneEndingForPacket = (sealed) =>
  sealed ? EPISODE_ONE_ENDINGS.true : EPISODE_ONE_ENDINGS.false;
