// Stable render key for the route-risk action tray.
//
// The tray is evaluated from this small durable-memory axis every frame;
// callers use this key to avoid replacing visible buttons when that axis
// has not changed under the player's finger (a phone tap that lands on
// a node replaced before its click resolves is the tap-breaking bug
// this module guards against — see aftersign/main.js's `renderText`
// route-risk branch and the sibling
// `e2e/route-risk-tray-hide-show-played.spec.ts`).
//
// Authored as `.ts` (not `.js`) so it sits under
// `aftersign/tsconfig.json`'s blocking `include: ["src"]` gate. That
// config does NOT set `allowJs` (documented in tsconfig.json's header),
// so a `.js` sibling under `src/` would red `typecheck:aftersign` on
// "input file was not found in any include path" — the exact failure
// Soren's REQUEST_CHANGES on PR #1795 flagged.
//
// The durable memory axis is `state.player.routeRisk`, whose runtime
// shape is `{ lastRoute: "fast" | "safe"; succeeded: boolean } | null
// | undefined`. This module accepts `unknown` so the caller (main.js,
// which is plain JS and passes the value straight through) does not
// have to import a type; the narrowing is done here.

export type RouteRiskRenderSignature =
  | "fresh"
  | "fast:succeeded"
  | "fast:failed"
  | "safe:succeeded"
  | "safe:failed";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const buildRouteRiskRenderSignature = (
  memory: unknown,
): RouteRiskRenderSignature => {
  if (!isRecord(memory)) return "fresh";
  const route = memory.lastRoute === "fast" ? "fast" : "safe";
  const result = memory.succeeded === false ? "failed" : "succeeded";
  return `${route}:${result}` as RouteRiskRenderSignature;
};
