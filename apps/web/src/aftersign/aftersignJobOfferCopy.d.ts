/**
 * TypeScript companion for `aftersignJobOfferCopy.js` — the JS module
 * stays authoritative for the frozen strings (so non-TS reviewers can
 * eyeball the copy without a compile step), and this file lets TS
 * consumers (`harness/bootWindowGame.ts`, the consumer test) type-
 * check imports without an `any` boundary.
 *
 * If a new memory branch is added to the JS export, mirror the shape
 * here so `chooseAftersignJobOfferCopy` keeps narrowing correctly.
 */

/**
 * The runtime-state axes the branch selector reads. Kept LOOSE on
 * purpose — the JS selector defensively handles missing fields (a
 * fresh boot with `{}` returns the first-run branch), and TS
 * consumers pass the vertical-slice state fields they actually have
 * (`packetOutcome`, and optionally the higher-level tokens the story
 * beat resolver may later expose).
 */
export type AftersignJobOfferMemory = {
  /** `"opened"` or `packetOpened=true` → wax-debt branch. */
  packetOpened?: boolean;
  /** `"sealed" | "opened" | "pending"` — the vertical-slice fork. Null is safe (falls through to firstRun). */
  firstPacketOutcome?: "sealed" | "opened" | "pending" | string | null;
  /** Optional Io-side posture; `"trusted"` promotes to Orra's-name branch. */
  trustPosture?: string;
  /** Alias reserved for future beat wiring; same semantics as `trustPosture`. */
  ioTrustPosture?: string;
  /** Convenience flag equivalent to `firstPacketOutcome === "sealed"`. */
  deliveredSealed?: boolean;
};

/**
 * One frozen copy row — the strings a scene renderer paints when Io
 * hands the player the next-job tag on THIS memory branch. Fields
 * match `AFTERSIGN_JOB_OFFER_COPY.<branch>` in the JS module.
 */
export type AftersignJobOfferCopy = {
  readonly id: string;
  /** Explicit input token for accepting this memory-branched offer. */
  readonly tappableActionId: string;
  readonly title: string;
  readonly actionLabel: string;
  readonly summary: string;
  readonly ioLine: string;
  readonly riskPrompt: string;
  readonly safeRouteLabel: string;
  readonly riskyRouteLabel: string;
  /** One-line route instruction Io gives with the tag. */
  readonly route: string;
  /** One-line risk summary Io gives with the tag. */
  readonly risk: string;
};

export type AftersignJobOfferCopyTable = {
  readonly firstRun: AftersignJobOfferCopy;
  readonly trusted: AftersignJobOfferCopy;
  readonly opened: AftersignJobOfferCopy;
};

export const AFTERSIGN_JOB_OFFER_COPY: AftersignJobOfferCopyTable;

export function chooseAftersignJobOfferCopy(
  memory?: AftersignJobOfferMemory,
): AftersignJobOfferCopy;
