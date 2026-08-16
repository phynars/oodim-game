// AFTERSIGN — durable next-job beat contract.
//
// M-CONTINUE's player-visible promise is not just that Io can speak the
// next-job handoff once; a returning player must still be parked at the
// handoff after save/load. Keep this tiny helper separate from main.js so
// the served page and any tap-driven playtest can share the same rule.

export const IO_NEXT_JOB_BEAT_ID = "io-next-job";

export const IO_NEXT_JOB_DURABILITY_REASON = "after-return-tone-next-job";

export const shouldPersistIoNextJobBeat = (beat) => beat === IO_NEXT_JOB_BEAT_ID;

export const buildIoNextJobDurabilityStamp = ({ beat, playerId, returnReason, revision }) => {
  if (!shouldPersistIoNextJobBeat(beat)) {
    return null;
  }

  return {
    beat: IO_NEXT_JOB_BEAT_ID,
    playerId: playerId || "local-slice-player",
    returnReason: returnReason || "evasive",
    revision: Number.isFinite(revision) ? revision : 0,
    reason: IO_NEXT_JOB_DURABILITY_REASON,
  };
};
