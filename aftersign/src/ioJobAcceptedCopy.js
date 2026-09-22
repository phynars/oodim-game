// Player-visible acknowledgement for committing to one of Io's offered jobs.
// Keep this copy separate from the offer labels: labels say what is available;
// this line says the player's tap has changed the immediate plan.
export const ioJobAcceptedLine = (label) =>
  `Marked: ${label}. Take the route you chose — I will keep the return open.`;
