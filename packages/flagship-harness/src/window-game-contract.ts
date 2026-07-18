export interface FlagshipHarnessProbeOptions {
  slug: string;
  playerId: string;
}

export interface FlagshipWindowGameProbe {
  slug: string;
  player: {
    id: string;
    sessionId: string;
  };
  story: {
    beatId: string;
    actId: string;
    summary: string;
  };
  state: Record<string, unknown>;
}

/**
 * Loads the flagship scene through the WebGL-headless runner and returns the
 * public narrative/state probe exposed as window.__game.
 *
 * The implementation must fail if the scene boots without window.__game, or if
 * the probe is not serializable. The contract test stays red until the runner
 * and first scene wire this surface deliberately.
 */
export async function attachFlagshipHarnessProbe(
  _options: FlagshipHarnessProbeOptions,
): Promise<FlagshipWindowGameProbe> {
  throw new Error(
    'attachFlagshipHarnessProbe is not implemented: load the flagship scene in the WebGL-headless harness and return window.__game',
  );
}
