/**
 * TypeScript companion for `aftersignJobTakeFeel.js` — the JS module
 * stays authoritative for the frozen tactile envelope (so non-TS
 * reviewers can eyeball the numbers without a compile step), and
 * this file lets TS consumers (`harness/bootWindowGame.ts`, the
 * consumer test) type-check imports without an `any` boundary.
 *
 * Runtime-state axes are LOOSE on purpose: the JS resolver defensively
 * handles missing fields — a call with no `actionId` yields the
 * `take-job-unknown` fallback row.
 */

export type AftersignJobTakeFeelEasing = {
  readonly press: string;
  readonly release: string;
  readonly glow: string;
};

export type AftersignJobTakeFeelAudio = {
  readonly cue: string;
  readonly startMs: number;
  readonly peakMs: number;
};

export type AftersignJobTakeFeel = {
  readonly kind: "aftersign-job-take";
  readonly durationMs: number;
  readonly holdMs: number;
  readonly travelPx: number;
  readonly scaleFrom: number;
  readonly scalePeak: number;
  readonly settleScale: number;
  readonly glowPeakOpacity: number;
  readonly glowSettleOpacity: number;
  readonly shadowLiftPx: number;
  readonly easing: AftersignJobTakeFeelEasing;
  readonly audio: AftersignJobTakeFeelAudio;
};

export type AftersignJobTakeFeelResolveInput = {
  actionId?: string | null;
  route?: string | null;
  risk?: string | null;
};

export type AftersignJobTakeFeelRow = AftersignJobTakeFeel & {
  readonly actionId: string;
  readonly ariaLabel: string;
  readonly route: string;
  readonly risk: string;
};

export const AFTERSIGN_JOB_TAKE_FEEL: AftersignJobTakeFeel;

export function resolveAftersignJobTakeFeel(
  input?: AftersignJobTakeFeelResolveInput,
): AftersignJobTakeFeelRow;
