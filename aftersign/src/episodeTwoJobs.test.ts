// Data-layer checks for the Episode 2 door-decided jobs (#2918), run by
// aftersign/pure-runner.ts. Export-only: no top-level call. The module
// has no imports, so this runs under `node --experimental-strip-types`.

// @ts-ignore -- plain JS module without declarations; checks run untyped.
import { DOOR_CHOICES, EPISODE_TWO_JOBS, episodeTwoJobForStory } from "./episodeTwoJobs.js";
// @ts-ignore -- plain JS module without declarations; checks run untyped.
import { createPersistHelpers } from "./runtime/persistence.js";

const assert = (cond: unknown, label: string): void => {
  if (!cond) throw new Error(`episodeTwoJobs: ${label}`);
};

export async function runEpisodeTwoJobsChecks(): Promise<void> {
  assert(DOOR_CHOICES.length === 3, "three door choices");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jobs: any[] = DOOR_CHOICES.map((c: string) => EPISODE_TWO_JOBS[c]);
  jobs.forEach((job, i) => {
    assert(job && job.doorChoice === DOOR_CHOICES[i], `job keyed to ${DOOR_CHOICES[i]}`);
    assert(job.name && job.brief, `job ${job.id} has copy`);
  });
  for (const key of ["id", "name", "deliveryId", "brief"]) {
    assert(new Set(jobs.map((j) => j[key])).size === 3, `unique ${key}`);
  }

  assert(episodeTwoJobForStory(null) === null, "null story -> no job");
  assert(episodeTwoJobForStory({ doorChoice: null }) === null, "no door -> no job");
  assert(episodeTwoJobForStory({ doorChoice: "bogus" }) === null, "unknown door -> no job");

  // Round-trip through the persisted payload: the door chosen in
  // Episode 1 is what the Night Post reads after restore.
  for (const choice of DOOR_CHOICES) {
    const state = {
      scene: { beat: "idle" },
      player: { id: "p1", returnReason: null },
      packet: {},
      delivery: {},
      story: { doorChoice: choice, episodeTwoNightPost: true },
      npcs: { io: { memory: [] }, orra: { memory: [], lastLine: null, lastLineId: null } },
      save: { revision: 1 },
    };
    const { buildPersistPayload } = createPersistHelpers({
      state,
      slot: "default",
      clone: (v: unknown) => JSON.parse(JSON.stringify(v ?? null)),
      markStateDirty: () => {},
      writeStored: () => true,
      writeAuthoritativeSave: async () => {},
    });
    const restored = JSON.parse(JSON.stringify(buildPersistPayload()));
    const job = episodeTwoJobForStory(restored.story);
    assert(job && job.doorChoice === choice, `restored ${choice} -> its job`);
  }
}
