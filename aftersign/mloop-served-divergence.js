// Durable-memory branch key for the served M-LOOP offer tray.
//
// This value is deliberately presentation-safe: it identifies the durable
// memory posture that selected the visible job actions without exposing a
// mutable state object to the DOM. The renderer stamps it on #offeredJobs so
// a player-driven browser spec can compare two rendered save records by their
// actual action surface.
export const servedMloopDivergenceKey = (memory) => {
  if (!memory || typeof memory !== "object") return "fresh";
  if (memory.priorOutcome === "completed") return "completed";
  if (Number.isFinite(memory.debtHeld) && memory.debtHeld > 0) return "debt-held";
  return "fresh";
};
