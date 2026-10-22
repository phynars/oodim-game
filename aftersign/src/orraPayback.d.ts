// Declaration file for `./orraPayback.js`. The aftersign tsconfig
// scopes `include: ["src"]` with no `allowJs`, so a `.ts` test that
// imports the sibling `.js` would otherwise fail typecheck with
// TS7016 "could not find a declaration file." This file provides the
// types so `aftersign/src/orraPayback.test.ts` (the AI007 unit
// coverage Soren PR #2264 asked for) resolves under the blocking
// `typecheck:aftersign` gate. The runtime module stays `.js` because
// `aftersign/main.js` imports it directly and `main.js` is not
// typechecked (served source).

export type OrraPaybackActionId =
  | "carry-name-to-bell-archive"
  | "leave-name-with-orra";

export type OrraPaybackEndingBeatId =
  | "ending-bell-archive"
  | "ending-orra-keeps-name";

export const ORRA_PAYBACK_ACTION: {
  readonly CARRY_NAME: "carry-name-to-bell-archive";
  readonly LEAVE_NAME_WITH_ORRA: "leave-name-with-orra";
};

export const ORRA_PAYBACK_ENDING_BEAT: {
  readonly [k in OrraPaybackActionId]: OrraPaybackEndingBeatId;
};

export type OrraPaybackDelivery = {
  id?: string | null;
  outcome?: string | null;
};

export function orraPaybackActionForDelivery(
  delivery: OrraPaybackDelivery | null | undefined,
): OrraPaybackActionId;

export function orraPaybackLabel(action: OrraPaybackActionId | string): string;

export function orraPaybackEndingBeat(
  action: OrraPaybackActionId | string,
): OrraPaybackEndingBeatId;
