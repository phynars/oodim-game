import { describe, expect, it } from "vitest";
import {
  COMPLETED_JOB_IDS,
  SAFE_DEFAULT_JOB_ID,
  TRUSTED_COURIER_JOB_IDS,
  selectIoJobOffers,
} from "./computeOfferedJobs";
import {
  collectTappableJobOfferKeys,
  fingerprintJobOfferAction,
  fingerprintJobOfferActions,
  ioJobOffersDiverge,
} from "./jobOfferActionFingerprint";

describe("jobOfferActionFingerprint", () => {
  it("keys an offer by id + route risk, not label", () => {
    const fp = fingerprintJobOfferAction({
      id: "job-sealed-return",
      label: "Sealed return",
      routeRisk: "medium",
      requiresMemory: true,
    });
    expect(fp).toEqual({
      id: "job-sealed-return",
      semanticKey: "job-sealed-return#medium",
    });
  });

  it("fingerprints an offered-jobs array order-independently", () => {
    const trusted = selectIoJobOffers({ trustPosture: "trusted-courier" });
    const shuffled = [...trusted].reverse();
    expect(fingerprintJobOfferActions(trusted)).toEqual(
      fingerprintJobOfferActions(shuffled),
    );
  });

  it("reports divergence when the tappable action set actually changes", () => {
    const fresh = selectIoJobOffers(undefined);
    const returning = selectIoJobOffers({ priorOutcome: "completed" });
    expect(ioJobOffersDiverge(fresh, returning)).toBe(true);
    expect(collectTappableJobOfferKeys(fresh)).toEqual([
      `${SAFE_DEFAULT_JOB_ID}#low`,
    ]);
    expect(collectTappableJobOfferKeys(returning)).toEqual(
      [...COMPLETED_JOB_IDS].map((id) => {
        if (id === "job-night-transfer") return `${id}#medium`;
        if (id === "job-signed-receipt") return `${id}#low`;
        throw new Error(`unmapped COMPLETED_JOB_IDS entry: ${id}`);
      }).sort(),
    );
  });

  it("does NOT report divergence for label-copy-only drift", () => {
    // A copy editor tightens a label — the tappable action set is
    // unchanged. The founder bar rules dialogue-only diffs out of the
    // divergence metric; this is the guard.
    const original = selectIoJobOffers({ trustPosture: "trusted-courier" });
    const relabeled = original.map((offer) => ({
      ...offer,
      label: `${offer.label} — v2`,
    }));
    expect(ioJobOffersDiverge(original, relabeled)).toBe(false);
  });

  it("reports divergence when the risk tier of an offer changes", () => {
    // A rebalance moves `job-sealed-return` from medium to high risk.
    // The player's tap target is the same id but the mechanical
    // consequence changed — that counts.
    const trusted = selectIoJobOffers({ trustPosture: "trusted-courier" });
    const escalated = trusted.map((offer) =>
      offer.id === "job-sealed-return"
        ? { ...offer, routeRisk: "high" as const }
        : offer,
    );
    expect(ioJobOffersDiverge(trusted, escalated)).toBe(true);
  });

  it("reports divergence when trust posture and prior outcome pick different sets", () => {
    const trusted = selectIoJobOffers({ trustPosture: "trusted-courier" });
    const completed = selectIoJobOffers({ priorOutcome: "completed" });
    expect(ioJobOffersDiverge(trusted, completed)).toBe(true);
    expect(new Set(collectTappableJobOfferKeys(trusted))).toEqual(
      new Set([...TRUSTED_COURIER_JOB_IDS].map((id) => {
        if (id === "job-sealed-return") return `${id}#medium`;
        if (id === "job-private-ledger") return `${id}#high`;
        throw new Error(`unmapped TRUSTED_COURIER_JOB_IDS entry: ${id}`);
      })),
    );
  });

  it("reports non-divergence for identical memory records", () => {
    const a = selectIoJobOffers({ priorOutcome: "completed" });
    const b = selectIoJobOffers({ priorOutcome: "completed" });
    expect(a).not.toBe(b); // fresh arrays each call
    expect(ioJobOffersDiverge(a, b)).toBe(false);
  });
});
