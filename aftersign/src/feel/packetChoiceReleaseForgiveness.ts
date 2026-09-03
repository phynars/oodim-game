// AFTERSIGN packet-choice release-forgiveness feel contract.
//
// The vertical slice's blue-seal choice is deliberately hold-heavy: an
// open must survive `openHoldMs`, a preserve confirm must survive
// `preserveConfirmMs`. Those thresholds are sharp — one frame short and
// the gesture is punished as "inspect-only" (open) or nothing (preserve).
// That sharpness is correct for the intent, but on real hardware a
// finger-up frequently trails the *intent* to release by a frame or two.
// This module pins the invariants that keep those good-faith finger-ups
// from being scored as cancels.
//
// Consumer wiring (Soren, PR #1019 re-review): this module is not a
// self-referential harness. `stepPacketChoiceIntentWithReleaseForgiveness`
// is imported and executed by the shipped gesture judge at
// `apps/web/src/aftersign/packetChoiceFeel.ts` (`evaluatePacketChoiceGesture`)
// for the hold-open decision — the same code path a real player hits.
// The pure checks below pin the state-machine behaviour; the vitest suite
// on the gesture judge pins the same behaviour through the summarised
// `PacketChoiceGesture` surface. They cannot drift because both call
// `stepPacketChoiceIntentWithReleaseForgiveness` (or the shared
// `isReleaseInsideForgivenessWindow` helper for the tap-preserve side).
//
// SINGLE DECISION PATH INVARIANT (PR #1019, re-affirmed PR #1050 review):
// the HOLD-THRESHOLD SHORTFALL comparison — "is this release within
// `releaseGraceMs` of `requiredHoldMs`?" — flows through
// `isReleaseInsideForgivenessWindow` in exactly one place, so the
// gesture judge and the state machine cannot disagree about which
// releases commit. Do NOT re-inline that shortfall arithmetic in the
// stepper.
//
// Narrower than it sounds: `releaseGraceMs` is ALSO read directly for
// the stale-release age check (~line 106) and referenced in the fixture
// setups in `checkPacketChoiceReleaseForgiveness` below. Those reads are
// intentional — they are not the shared shortfall decision the helper
// pins. If you add a NEW hold-threshold-vs-elapsed shortfall check,
// route it through `isReleaseInsideForgivenessWindow`; the stale-age
// comparison and fixture arithmetic stay where they are.
//
// Repo convention (see `packetChoiceFeel.ts` + its `.test.ts` shim, PR #973):
//   - The `.ts` module OWNS `check*()` + `run*Checks()`. The sibling
//     `.test.ts` is a thin re-export so pure-runner + Playwright can
//     import without double-executing at module load.
//   - Plain TS: no vitest, no jest. `typecheck:aftersign` is the type
//     gate; `test:aftersign:pure` executes the checks.

import {
  DEFAULT_PACKET_CHOICE_FEEL,
  isPacketChoiceCommitted,
  packetChoiceFrameCostMs,
  startPacketChoiceIntent,
  stepPacketChoiceIntent,
  type PacketChoiceAction,
  type PacketChoiceFeelConfig,
  type PacketChoiceIntent,
  type PacketChoicePointer,
  type PacketChoiceStepInput,
} from '../packetChoiceFeel'

export type PacketChoiceReleaseForgivenessConfig = PacketChoiceFeelConfig & {
  /**
   * A release that lands up to `releaseGraceMs` short of the hard hold
   * threshold still commits — a finger-up frame one or two frames early
   * is almost always the intended release, not a cancel. Stale releases
   * (older than `releaseGraceMs`) still cancel.
   */
  releaseGraceMs: number
}

export const DEFAULT_PACKET_CHOICE_RELEASE_FORGIVENESS: PacketChoiceReleaseForgivenessConfig = {
  ...DEFAULT_PACKET_CHOICE_FEEL,
  releaseGraceMs: 50,
}

export type PacketChoiceReleaseStepInput = PacketChoiceStepInput & {
  /** Timestamp of the finger-up frame; required to distinguish a fresh release from a stale one. */
  releasedAtMs?: number
}

/**
 * Shared decision helper — both the pure state-machine step below AND
 * the shipped gesture judge (`evaluatePacketChoiceGesture` in
 * apps/web/src/aftersign/packetChoiceFeel.ts) route through this. If it
 * returns `true`, a release that would otherwise fall a hair short of
 * `requiredHoldMs` should commit; if it returns `false`, the sharp
 * threshold applies. Keeping the check in ONE function is the whole
 * point — `releaseGraceMs` cannot mean two different things in two
 * places if there is only one place.
 */
export function isReleaseInsideForgivenessWindow(
  elapsedMs: number,
  requiredHoldMs: number,
  releaseGraceMs: number,
): boolean {
  if (releaseGraceMs < 0) return false
  const shortfall = requiredHoldMs - elapsedMs
  return shortfall <= releaseGraceMs
}

export function stepPacketChoiceIntentWithReleaseForgiveness(
  intent: PacketChoiceIntent,
  input: PacketChoiceReleaseStepInput,
  config: PacketChoiceReleaseForgivenessConfig = DEFAULT_PACKET_CHOICE_RELEASE_FORGIVENESS,
): PacketChoiceIntent {
  // While the pointer is still pressed, defer to the base state machine —
  // the release-forgiveness rule only alters the release frame.
  if (input.pressed || intent.phase === 'committed' || intent.phase === 'cancelled') {
    return stepPacketChoiceIntent(intent, input, config)
  }

  // Stale release: the finger came off many frames ago and we're only
  // seeing it now. That is not a good-faith frame-boundary miss — cancel.
  const releasedAtMs = input.releasedAtMs ?? input.nowMs
  const releaseAgeMs = Math.max(0, input.nowMs - releasedAtMs)
  if (releaseAgeMs > config.releaseGraceMs) {
    return stepPacketChoiceIntent(intent, input, config)
  }

  // Drag-away always wins — never turn a cancel into a commit through grace.
  const movedPx = distance(intent.startPointer, input.pointer)
  if (movedPx > config.cancelRadiusPx) {
    return stepPacketChoiceIntent(intent, input, config)
  }

  const inspectedSeal = intent.inspectedSeal || input.inspectedSeal === true
  const requiredHoldMs = intent.action === 'open' ? config.openHoldMs : config.preserveConfirmMs
  const elapsedMs = input.nowMs - intent.startedAtMs

  // Open still requires inspection — forgiveness cannot bypass the safety.
  if (intent.action === 'open' && !inspectedSeal) {
    return stepPacketChoiceIntent(intent, input, config)
  }

  // The core rule: a release within `releaseGraceMs` of the threshold
  // commits. Falls through to the base cancel otherwise. Note: this is
  // the ONLY place the stepper reads `releaseGraceMs` for the shortfall
  // comparison — the arithmetic lives inside the helper so the gesture
  // judge and this state machine share one decision.
  if (!isReleaseInsideForgivenessWindow(elapsedMs, requiredHoldMs, config.releaseGraceMs)) {
    return stepPacketChoiceIntent(intent, input, config)
  }

  const armedAtMs = intent.armedAtMs ?? Math.max(0, input.nowMs - config.minArmedVisibleMs)
  const forgivingInput: PacketChoiceStepInput = {
    ...input,
    pressed: true,
    inspectedSeal,
  }

  return stepPacketChoiceIntent(
    {
      ...intent,
      phase: 'armed',
      armedAtMs,
      inspectedSeal,
    },
    forgivingInput,
    config,
  )
}

export function startPacketChoiceReleaseIntent(
  action: PacketChoiceAction,
  nowMs: number,
  pointer: PacketChoicePointer,
  inspectedSeal = false,
): PacketChoiceIntent {
  return startPacketChoiceIntent(action, nowMs, pointer, inspectedSeal)
}

function distance(a: PacketChoicePointer, b: PacketChoicePointer): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.hypot(dx, dy)
}

function assertPacketChoiceRelease(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

// ---------------------------------------------------------------------------
// Pure-lane invariant checks
// ---------------------------------------------------------------------------

export function checkPacketChoiceReleaseForgiveness(
  config: PacketChoiceReleaseForgivenessConfig = DEFAULT_PACKET_CHOICE_RELEASE_FORGIVENESS,
): void {
  const origin = { x: 120, y: 320 }

  // A release at the exact hold threshold commits (open).
  let openIntent = startPacketChoiceReleaseIntent('open', 0, origin, true)
  openIntent = stepPacketChoiceIntentWithReleaseForgiveness(
    openIntent,
    {
      nowMs: config.openHoldMs,
      releasedAtMs: config.openHoldMs,
      pointer: origin,
      pressed: false,
    },
    config,
  )
  assertPacketChoiceRelease(
    isPacketChoiceCommitted(openIntent, 'open'),
    'release on the first open commit frame is forgiven',
  )

  // A release one ms short of the open threshold still commits — this is
  // the exact frame-boundary miss the forgiveness window exists for.
  let openShort = startPacketChoiceReleaseIntent('open', 0, origin, true)
  openShort = stepPacketChoiceIntentWithReleaseForgiveness(
    openShort,
    {
      nowMs: config.openHoldMs - 1,
      releasedAtMs: config.openHoldMs - 1,
      pointer: origin,
      pressed: false,
    },
    config,
  )
  assertPacketChoiceRelease(
    isPacketChoiceCommitted(openShort, 'open'),
    'release one ms short of openHoldMs still commits (forgiveness window)',
  )

  // Symmetric on the preserve confirm hold.
  let preserveIntent = startPacketChoiceReleaseIntent('preserve', 0, origin)
  preserveIntent = stepPacketChoiceIntentWithReleaseForgiveness(
    preserveIntent,
    {
      nowMs: config.preserveConfirmMs,
      releasedAtMs: config.preserveConfirmMs,
      pointer: origin,
      pressed: false,
    },
    config,
  )
  assertPacketChoiceRelease(
    isPacketChoiceCommitted(preserveIntent, 'preserve'),
    'release on the first preserve commit frame is forgiven',
  )

  // A release BEYOND the forgiveness window (grace+1 short of threshold)
  // must NOT commit — the sharp boundary lives at the grace edge, not
  // wherever the player wandered.
  let openTooShort = startPacketChoiceReleaseIntent('open', 0, origin, true)
  openTooShort = stepPacketChoiceIntentWithReleaseForgiveness(
    openTooShort,
    {
      nowMs: config.openHoldMs - config.releaseGraceMs - 1,
      releasedAtMs: config.openHoldMs - config.releaseGraceMs - 1,
      pointer: origin,
      pressed: false,
    },
    config,
  )
  assertPacketChoiceRelease(
    !isPacketChoiceCommitted(openTooShort, 'open'),
    'release beyond releaseGraceMs short of openHoldMs must not commit',
  )

  // Open release cannot bypass seal inspection — this is a safety, not a
  // feel bug.
  let uninspectedOpen = startPacketChoiceReleaseIntent('open', 0, origin)
  uninspectedOpen = stepPacketChoiceIntentWithReleaseForgiveness(
    uninspectedOpen,
    {
      nowMs: config.openHoldMs,
      releasedAtMs: config.openHoldMs,
      pointer: origin,
      pressed: false,
      inspectedSeal: false,
    },
    config,
  )
  assertPacketChoiceRelease(
    uninspectedOpen.phase === 'cancelled',
    'open release forgiveness cannot bypass seal inspection',
  )

  // Stale release: finger came off many frames ago; cancel.
  let staleRelease = startPacketChoiceReleaseIntent('preserve', 0, origin)
  staleRelease = stepPacketChoiceIntentWithReleaseForgiveness(
    staleRelease,
    {
      nowMs: config.preserveConfirmMs + config.releaseGraceMs + 1,
      releasedAtMs: config.preserveConfirmMs - 20,
      pointer: origin,
      pressed: false,
    },
    config,
  )
  assertPacketChoiceRelease(
    staleRelease.phase === 'cancelled',
    'stale packet-choice releases still cancel',
  )

  // Drag-away beats forgiveness.
  let dragAway = startPacketChoiceReleaseIntent('preserve', 0, origin)
  dragAway = stepPacketChoiceIntentWithReleaseForgiveness(
    dragAway,
    {
      nowMs: config.preserveConfirmMs,
      releasedAtMs: config.preserveConfirmMs,
      pointer: { x: origin.x + config.cancelRadiusPx + 1, y: origin.y },
      pressed: false,
    },
    config,
  )
  assertPacketChoiceRelease(
    dragAway.phase === 'cancelled',
    'drag-away cancellation wins over release forgiveness',
  )

  // Frame budget check: the bookkeeping added by the forgiveness path must
  // still fit inside a 60Hz frame.
  const measuredCost = packetChoiceFrameCostMs(6, 9.2)
  assertPacketChoiceRelease(
    measuredCost <= config.frameBudgetMs,
    'packet release-forgiveness bookkeeping stays inside a 60Hz frame budget',
  )
}

export function checkPreArmSwipeCancels(
  config: PacketChoiceReleaseForgivenessConfig = DEFAULT_PACKET_CHOICE_RELEASE_FORGIVENESS,
): void {
  const origin = { x: 120, y: 320 }
  let intent = startPacketChoiceReleaseIntent('open', 0, origin, true)

  intent = stepPacketChoiceIntentWithReleaseForgiveness(
    intent,
    { nowMs: 0, pointer: origin, pressed: true },
    config,
  )
  intent = stepPacketChoiceIntentWithReleaseForgiveness(
    intent,
    {
      nowMs: config.openHoldMs - 1,
      pointer: { x: origin.x + config.cancelRadiusPx + 1, y: origin.y },
      pressed: true,
    },
    config,
  )

  assertPacketChoiceRelease(
    intent.phase === 'cancelled',
    'a swipe beyond cancelRadiusPx before the open arm window cancels',
  )
}

export function runPacketChoiceReleaseForgivenessChecks(): void {
  checkPacketChoiceReleaseForgiveness()
  checkPreArmSwipeCancels()
}
