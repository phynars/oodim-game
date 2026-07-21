export type MovementInputSource = "none" | "keyboard" | "touch" | "script" | "harness";

export interface PlayerMovementFeelConfig {
  fixedStepSeconds: number;
  targetFrameMs: number;
  speedMetersPerSecond: number;
  deadzone: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  inputToVelocityFrames: number;
}

export interface PlayerMovementInput {
  x: number;
  z: number;
  source: MovementInputSource;
  active: boolean;
}

export interface PlayerMovementState {
  x: number;
  z: number;
  facingRadians: number;
  input: PlayerMovementInput;
  lastStepMs: number;
  lastVelocityMetersPerSecond: number;
}

export interface PlayerMovementStepResult {
  state: PlayerMovementState;
  velocityX: number;
  velocityZ: number;
  movedX: number;
  movedZ: number;
}

export interface PlayerMovementFeelReport {
  passed: boolean;
  movedThisFrame: boolean;
  fixedStepInsideBudget: boolean;
  diagonalIsNormalized: boolean;
  deadzoneIsSilent: boolean;
  clampHeld: boolean;
  lastStepMs: number;
  targetFrameMs: number;
  inputToVelocityFrames: number;
}

export const DEFAULT_PLAYER_MOVEMENT_FEEL: PlayerMovementFeelConfig = {
  fixedStepSeconds: 1 / 60,
  targetFrameMs: 16.67,
  speedMetersPerSecond: 3.6,
  deadzone: 0.08,
  minX: -5.2,
  maxX: 5.2,
  minZ: -6.4,
  maxZ: 2.2,
  inputToVelocityFrames: 1,
};

export const createPlayerMovementState = (
  partial: Partial<Omit<PlayerMovementState, "input">> & { input?: Partial<PlayerMovementInput> } = {},
): PlayerMovementState => ({
  x: partial.x ?? -1.8,
  z: partial.z ?? 1.15,
  facingRadians: partial.facingRadians ?? 0,
  input: {
    x: partial.input?.x ?? 0,
    z: partial.input?.z ?? 0,
    source: partial.input?.source ?? "none",
    active: partial.input?.active ?? false,
  },
  lastStepMs: partial.lastStepMs ?? 0,
  lastVelocityMetersPerSecond: partial.lastVelocityMetersPerSecond ?? 0,
});

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const cloneMovementState = (state: PlayerMovementState): PlayerMovementState => ({
  ...state,
  input: { ...state.input },
});

export const normalizeMoveInput = (
  x: number,
  z: number,
  source: MovementInputSource = "script",
  config: PlayerMovementFeelConfig = DEFAULT_PLAYER_MOVEMENT_FEEL,
): PlayerMovementInput => {
  const length = Math.hypot(x, z);
  const scale = length > 1 ? 1 / length : 1;
  const nextX = x * scale;
  const nextZ = z * scale;
  const deadzonedX = Math.abs(nextX) < config.deadzone ? 0 : nextX;
  const deadzonedZ = Math.abs(nextZ) < config.deadzone ? 0 : nextZ;

  return {
    x: deadzonedX,
    z: deadzonedZ,
    source,
    active: Math.hypot(nextX, nextZ) >= config.deadzone,
  };
};

export const stepPlayerMovement = (
  current: PlayerMovementState,
  dtSeconds = DEFAULT_PLAYER_MOVEMENT_FEEL.fixedStepSeconds,
  config: PlayerMovementFeelConfig = DEFAULT_PLAYER_MOVEMENT_FEEL,
): PlayerMovementStepResult => {
  const state = cloneMovementState(current);
  const velocityX = state.input.x * config.speedMetersPerSecond;
  const velocityZ = state.input.z * config.speedMetersPerSecond;
  const startX = state.x;
  const startZ = state.z;

  state.x = clamp(state.x + velocityX * dtSeconds, config.minX, config.maxX);
  state.z = clamp(state.z + velocityZ * dtSeconds, config.minZ, config.maxZ);
  if (state.input.x || state.input.z) {
    state.facingRadians = Math.atan2(state.input.x, state.input.z);
  }
  state.lastStepMs = dtSeconds * 1000;
  state.lastVelocityMetersPerSecond = Math.hypot(velocityX, velocityZ);

  return {
    state,
    velocityX,
    velocityZ,
    movedX: state.x - startX,
    movedZ: state.z - startZ,
  };
};

export const checkPlayerMovementFeel = (
  config: PlayerMovementFeelConfig = DEFAULT_PLAYER_MOVEMENT_FEEL,
): PlayerMovementFeelReport => {
  const start = createPlayerMovementState();
  const rightInput = normalizeMoveInput(1, 0, "harness", config);
  const rightStep = stepPlayerMovement({ ...start, input: rightInput }, config.fixedStepSeconds, config);
  const movedThisFrame = rightStep.state.x > start.x && rightStep.state.z === start.z;
  const fixedStepInsideBudget = rightStep.state.lastStepMs <= config.targetFrameMs + 0.01;

  const diagonalInput = normalizeMoveInput(1, 1, "harness", config);
  const diagonalStep = stepPlayerMovement({ ...start, input: diagonalInput }, config.fixedStepSeconds, config);
  const diagonalIsNormalized = diagonalStep.state.lastVelocityMetersPerSecond <= config.speedMetersPerSecond + 0.000001;

  const deadzoneInput = normalizeMoveInput(config.deadzone * 0.5, 0, "harness", config);
  const deadzoneStep = stepPlayerMovement({ ...start, input: deadzoneInput }, config.fixedStepSeconds, config);
  const deadzoneIsSilent = deadzoneStep.state.x === start.x && deadzoneStep.state.lastVelocityMetersPerSecond === 0;

  const edgeStart = createPlayerMovementState({ x: config.maxX - 0.001, input: normalizeMoveInput(1, 0, "harness", config) });
  const edgeStep = stepPlayerMovement(edgeStart, config.fixedStepSeconds, config);
  const clampHeld = edgeStep.state.x === config.maxX;

  return {
    passed: movedThisFrame && fixedStepInsideBudget && diagonalIsNormalized && deadzoneIsSilent && clampHeld,
    movedThisFrame,
    fixedStepInsideBudget,
    diagonalIsNormalized,
    deadzoneIsSilent,
    clampHeld,
    lastStepMs: rightStep.state.lastStepMs,
    targetFrameMs: config.targetFrameMs,
    inputToVelocityFrames: config.inputToVelocityFrames,
  };
};

export const runPlayerMovementFeelChecks = () => {
  const report = checkPlayerMovementFeel();
  if (!report.passed) {
    throw new Error(`AFTERSIGN player movement feel contract failed: ${JSON.stringify(report)}`);
  }
  return report;
};
