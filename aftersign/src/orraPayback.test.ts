// M3-E1 (#2260) — unit coverage for Saint Orra's red-tag payback
// outcome. Plain-TS assertion harness: this repo typechecks
// aftersign/src/*.test.ts as a CI drift guard instead of running a
// unit-test runner (mirrors `aftersign/src/kioskCameraRig.test.ts`).
// Importing a .js module from a .ts test works through the project's
// `allowJs` tsconfig; keep the imported symbols typed by their JSDoc.
//
// This test is the "unit coverage" the PR body referenced but did
// NOT ship on the earlier draft (Soren PR #2264 review AI007). It
// pins the pure contract that drives `renderText()`'s payback button
// id and `choose()`'s commit branch in `aftersign/main.js`:
//
//   • sealed red-tag  → carry-name-to-bell-archive   (CRITERION A — sealed)
//   • opened red-tag  → leave-name-with-orra         (CRITERION A — opened)
//   • unknown red-tag → leave-name-with-orra         (safe default)
//   • blue-packet     → leave-name-with-orra         (gate — payback
//                       button is NOT rendered off the red-tag beat;
//                       the function still returns a safe id so the
//                       commit branch is defensively well-defined)
//
// The two-outcome / two-action-id invariant (criterion A) is proven
// in this file, independently of the e2e walk, so a future change
// that collapses the two outcomes to one action id reds a check
// without needing a full WebGL walk.
import {
  ORRA_PAYBACK_ACTION,
  ORRA_PAYBACK_ENDING_BEAT,
  orraPaybackActionForDelivery,
  orraPaybackEndingBeat,
  orraPaybackLabel,
} from "./orraPayback.js";

class OrraPaybackAssertionError extends Error {}

// Must be a `function` declaration, not an arrow assigned to `const`:
// TypeScript rejects `asserts` predicate return types on arrow-function
// const declarations. Same discipline as `kioskCameraRig.test.ts`.
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new OrraPaybackAssertionError(message);
}

type Delivery = { id?: string; outcome?: string };

function checkSealedRedTagMapsToCarryName(): void {
  const sealedRedTag: Delivery = { id: "red-tag", outcome: "sealed" };
  const action = orraPaybackActionForDelivery(sealedRedTag);
  assert(
    action === ORRA_PAYBACK_ACTION.CARRY_NAME,
    `sealed red-tag must map to CARRY_NAME, got ${String(action)}`,
  );
  assert(
    action === "carry-name-to-bell-archive",
    `CARRY_NAME must equal the stable element id "carry-name-to-bell-archive", got ${String(action)}`,
  );
}

function checkOpenedRedTagMapsToLeaveWithOrra(): void {
  const openedRedTag: Delivery = { id: "red-tag", outcome: "opened" };
  const action = orraPaybackActionForDelivery(openedRedTag);
  assert(
    action === ORRA_PAYBACK_ACTION.LEAVE_NAME_WITH_ORRA,
    `opened red-tag must map to LEAVE_NAME_WITH_ORRA, got ${String(action)}`,
  );
  assert(
    action === "leave-name-with-orra",
    `LEAVE_NAME_WITH_ORRA must equal the stable element id "leave-name-with-orra", got ${String(action)}`,
  );
}

function checkTwoDifferentOutcomesExposeTwoDifferentActionIds(): void {
  // The precise contract #2260 criterion A names: two records with
  // different outcomes expose different enabled action ids. Prove it
  // here by comparing the two action ids returned for the same
  // delivery id with the two shipped outcomes.
  const sealed = orraPaybackActionForDelivery({ id: "red-tag", outcome: "sealed" });
  const opened = orraPaybackActionForDelivery({ id: "red-tag", outcome: "opened" });
  assert(
    sealed !== opened,
    `criterion A broken: sealed and opened red-tag outcomes map to the same action id ("${String(sealed)}")`,
  );
}

function checkUnknownRedTagFallsBackSafely(): void {
  // Round-two restore paths with no outcome yet (just-restored, no
  // packet gesture resolved) must not expose carry-name. Fall back
  // to the leave-with-orra alternative.
  const unknownRedTag: Delivery = { id: "red-tag", outcome: "unknown" };
  const action = orraPaybackActionForDelivery(unknownRedTag);
  assert(
    action === ORRA_PAYBACK_ACTION.LEAVE_NAME_WITH_ORRA,
    `unknown red-tag outcome must fall back to LEAVE_NAME_WITH_ORRA, got ${String(action)}`,
  );
}

function checkBluePacketFallsBackSafely(): void {
  // The payback button only renders when `delivery.id === "red-tag"`
  // (see `renderText()` in `aftersign/main.js`), but the function
  // must still return a defensive id so the commit branch is
  // well-defined if ever called off-beat.
  const sealedBlue: Delivery = { id: "blue-packet", outcome: "sealed" };
  const action = orraPaybackActionForDelivery(sealedBlue);
  assert(
    action === ORRA_PAYBACK_ACTION.LEAVE_NAME_WITH_ORRA,
    `blue-packet must fall back to LEAVE_NAME_WITH_ORRA, got ${String(action)}`,
  );
}

function checkMissingDeliveryIsSafe(): void {
  const nothing = orraPaybackActionForDelivery(undefined as unknown as Delivery);
  assert(
    nothing === ORRA_PAYBACK_ACTION.LEAVE_NAME_WITH_ORRA,
    `missing delivery must fall back to LEAVE_NAME_WITH_ORRA, got ${String(nothing)}`,
  );
}

function checkEndingBeatRoundTripsBothActions(): void {
  // The ending-beat id is a forward hook for #2259's consumer; today
  // `aftersign/main.js` reads it onto the committed button as
  // `data-orra-payback-ending`. Pin both branches so a future change
  // that collapses them to one id reds here.
  const carryEnding = orraPaybackEndingBeat(ORRA_PAYBACK_ACTION.CARRY_NAME);
  const leaveEnding = orraPaybackEndingBeat(ORRA_PAYBACK_ACTION.LEAVE_NAME_WITH_ORRA);
  assert(
    carryEnding === ORRA_PAYBACK_ENDING_BEAT[ORRA_PAYBACK_ACTION.CARRY_NAME],
    `CARRY_NAME must map to its own ending-beat id, got ${String(carryEnding)}`,
  );
  assert(
    leaveEnding === ORRA_PAYBACK_ENDING_BEAT[ORRA_PAYBACK_ACTION.LEAVE_NAME_WITH_ORRA],
    `LEAVE_NAME_WITH_ORRA must map to its own ending-beat id, got ${String(leaveEnding)}`,
  );
  assert(
    carryEnding !== leaveEnding,
    `two different payback actions must carry two different ending-beat ids`,
  );
}

function checkEndingBeatFallsBackForUnknownAction(): void {
  // Defensive branch — if a legacy restored payload carries an
  // unrecognized `orraPaybackAction` string, the ending-beat lookup
  // must fall back to leave-with-orra, not throw.
  const fallback = orraPaybackEndingBeat("not-a-shipped-action");
  assert(
    fallback === ORRA_PAYBACK_ENDING_BEAT[ORRA_PAYBACK_ACTION.LEAVE_NAME_WITH_ORRA],
    `unknown action must fall back to the leave-with-orra ending beat, got ${String(fallback)}`,
  );
}

function checkLabelsAreDistinctAndNonEmpty(): void {
  const carryLabel = orraPaybackLabel(ORRA_PAYBACK_ACTION.CARRY_NAME);
  const leaveLabel = orraPaybackLabel(ORRA_PAYBACK_ACTION.LEAVE_NAME_WITH_ORRA);
  assert(typeof carryLabel === "string" && carryLabel.length > 0, "CARRY_NAME label must be a non-empty string");
  assert(typeof leaveLabel === "string" && leaveLabel.length > 0, "LEAVE_NAME_WITH_ORRA label must be a non-empty string");
  assert(carryLabel !== leaveLabel, "the two payback actions must carry distinct labels");
}

export function runOrraPaybackChecks(): void {
  checkSealedRedTagMapsToCarryName();
  checkOpenedRedTagMapsToLeaveWithOrra();
  checkTwoDifferentOutcomesExposeTwoDifferentActionIds();
  checkUnknownRedTagFallsBackSafely();
  checkBluePacketFallsBackSafely();
  checkMissingDeliveryIsSafe();
  checkEndingBeatRoundTripsBothActions();
  checkEndingBeatFallsBackForUnknownAction();
  checkLabelsAreDistinctAndNonEmpty();
}

// Export-only (no top-level invocation). The runner is registered in
// `aftersign/pure-runner.ts` and executes under `test:aftersign:pure`,
// matching the pattern documented in the pure-runner header
// (checklist item #2 — top-level calls double-run when a Playwright
// spec imports the same test file).
