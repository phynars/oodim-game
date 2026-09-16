// Stable render key for the route-risk action tray.
// The tray is evaluated from this small durable-memory axis every frame;
// callers use this key to avoid replacing visible buttons when that axis
// has not changed under the player's finger.
export const buildRouteRiskRenderSignature = (memory) => {
  if (!memory || typeof memory !== "object") return "fresh";
  const route = memory.lastRoute === "fast" ? "fast" : "safe";
  const result = memory.succeeded === false ? "failed" : "succeeded";
  return `${route}:${result}`;
};
