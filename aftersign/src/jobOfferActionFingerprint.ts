export type JobOfferActionFingerprintInput = {
  jobId: string;
  actionId: string;
  label: string;
  available: boolean;
  disabledReason?: string | null;
};

export type JobOfferActionFingerprint = {
  jobId: string;
  actionId: string;
  semanticKey: string;
  tappable: boolean;
};

export function normalizeJobOfferActionFingerprintValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function fingerprintJobOfferAction(
  input: JobOfferActionFingerprintInput,
): JobOfferActionFingerprint {
  const jobId = normalizeJobOfferActionFingerprintValue(input.jobId);
  const actionId = normalizeJobOfferActionFingerprintValue(input.actionId);
  const label = normalizeJobOfferActionFingerprintValue(input.label);
  const disabledReason = normalizeJobOfferActionFingerprintValue(
    input.disabledReason ?? "",
  );

  return {
    jobId,
    actionId,
    semanticKey: [jobId, actionId, label, disabledReason]
      .filter(Boolean)
      .join("/"),
    tappable: input.available && disabledReason.length === 0,
  };
}

export function fingerprintJobOfferActions(
  inputs: readonly JobOfferActionFingerprintInput[],
): JobOfferActionFingerprint[] {
  return inputs
    .map(fingerprintJobOfferAction)
    .sort((a, b) => a.semanticKey.localeCompare(b.semanticKey));
}

export function collectTappableJobOfferActionKeys(
  inputs: readonly JobOfferActionFingerprintInput[],
): string[] {
  return fingerprintJobOfferActions(inputs)
    .filter((fingerprint) => fingerprint.tappable)
    .map((fingerprint) => fingerprint.semanticKey);
}

export function jobOfferActionsDiverge(
  first: readonly JobOfferActionFingerprintInput[],
  second: readonly JobOfferActionFingerprintInput[],
): boolean {
  const firstKeys = collectTappableJobOfferActionKeys(first);
  const secondKeys = collectTappableJobOfferActionKeys(second);

  if (firstKeys.length !== secondKeys.length) return true;

  return firstKeys.some((key, index) => key !== secondKeys[index]);
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export function checkJobOfferActionFingerprintIgnoresCopyOnlyDivergence(): void {
  const safeJob = {
    jobId: "silt-stair-safe",
    actionId: "take-safe-route",
    available: true,
  };

  assert(
    !jobOfferActionsDiverge(
      [{ ...safeJob, label: "Carry the blue packet" }],
      [{ ...safeJob, label: "Take the blue packet" }],
    ),
    "job-offer divergence must not be satisfied by copy-only label drift",
  );
}

export function checkJobOfferActionFingerprintSeesAvailableActionDivergence(): void {
  assert(
    jobOfferActionsDiverge(
      [
        {
          jobId: "silt-stair-safe",
          actionId: "take-safe-route",
          label: "Carry the blue packet",
          available: true,
        },
      ],
      [
        {
          jobId: "silt-stair-risk",
          actionId: "take-dark-cut",
          label: "Take the dark cut",
          available: true,
        },
      ],
    ),
    "different tappable job actions must count as mechanical divergence",
  );
}

export function checkJobOfferActionFingerprintSeesAvailabilityDivergence(): void {
  assert(
    jobOfferActionsDiverge(
      [
        {
          jobId: "orra-name",
          actionId: "haggle-price",
          label: "Ask Orra for the courier price",
          available: false,
          disabledReason: "Io does not trust you with Orra yet",
        },
      ],
      [
        {
          jobId: "orra-name",
          actionId: "haggle-price",
          label: "Ask Orra for the courier price",
          available: true,
        },
      ],
    ),
    "memory-gated availability must count as mechanical divergence",
  );
}

export function runJobOfferActionFingerprintChecks(): void {
  checkJobOfferActionFingerprintIgnoresCopyOnlyDivergence();
  checkJobOfferActionFingerprintSeesAvailableActionDivergence();
  checkJobOfferActionFingerprintSeesAvailabilityDivergence();
}
