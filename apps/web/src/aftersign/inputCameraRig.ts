export type AftersignInputKey = "KeyW" | "KeyA" | "KeyS" | "KeyD" | "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

export type AftersignInputEvent = {
  key: AftersignInputKey;
  type: "down" | "up";
  timeMs: number;
};

export type AftersignFrameSample = {
  timeMs: number;
  deltaMs: number;
};

export type AftersignRigState = {
  x: number;
  z: number;
  yawRadians: number;
  forward: number;
  strafe: number;
  lastInputTimeMs: number | null;
  lastRenderedInputTimeMs: number | null;
};

export type AftersignRigOptions = {
  metersPerSecond?: number;
  turnRadiansPerSecond?: number;
  maxInputToRenderMs?: number;
};

export type AftersignRigSnapshot = AftersignRigState & {
  inputToRenderMs: number | null;
  withinFrameBudget: boolean;
};

const DEFAULT_METERS_PER_SECOND = 3.2;
const DEFAULT_TURN_RADIANS_PER_SECOND = Math.PI * 0.72;
const DEFAULT_MAX_INPUT_TO_RENDER_MS = 16;

const FORWARD_KEYS = new Set<AftersignInputKey>(["KeyW", "ArrowUp"]);
const BACK_KEYS = new Set<AftersignInputKey>(["KeyS", "ArrowDown"]);
const LEFT_KEYS = new Set<AftersignInputKey>(["KeyA", "ArrowLeft"]);
const RIGHT_KEYS = new Set<AftersignInputKey>(["KeyD", "ArrowRight"]);

function createInitialState(): AftersignRigState {
  return {
    x: 0,
    z: 0,
    yawRadians: 0,
    forward: 0,
    strafe: 0,
    lastInputTimeMs: null,
    lastRenderedInputTimeMs: null,
  };
}

function normalizeAxis(negative: boolean, positive: boolean): -1 | 0 | 1 {
  if (negative === positive) return 0;
  return positive ? 1 : -1;
}

export class AftersignInputCameraRig {
  private readonly metersPerSecond: number;
  private readonly turnRadiansPerSecond: number;
  private readonly maxInputToRenderMs: number;
  private readonly keysDown = new Set<AftersignInputKey>();
  private state: AftersignRigState = createInitialState();

  constructor(options: AftersignRigOptions = {}) {
    this.metersPerSecond = options.metersPerSecond ?? DEFAULT_METERS_PER_SECOND;
    this.turnRadiansPerSecond = options.turnRadiansPerSecond ?? DEFAULT_TURN_RADIANS_PER_SECOND;
    this.maxInputToRenderMs = options.maxInputToRenderMs ?? DEFAULT_MAX_INPUT_TO_RENDER_MS;
  }

  reset(): AftersignRigSnapshot {
    this.keysDown.clear();
    this.state = createInitialState();
    return this.snapshot();
  }

  applyInput(event: AftersignInputEvent): AftersignRigSnapshot {
    if (event.type === "down") {
      this.keysDown.add(event.key);
    } else {
      this.keysDown.delete(event.key);
    }

    this.state = {
      ...this.state,
      forward: normalizeAxis(
        [...BACK_KEYS].some((key) => this.keysDown.has(key)),
        [...FORWARD_KEYS].some((key) => this.keysDown.has(key)),
      ),
      strafe: normalizeAxis(
        [...LEFT_KEYS].some((key) => this.keysDown.has(key)),
        [...RIGHT_KEYS].some((key) => this.keysDown.has(key)),
      ),
      lastInputTimeMs: event.timeMs,
      lastRenderedInputTimeMs: null,
    };

    return this.snapshot();
  }

  step(frame: AftersignFrameSample): AftersignRigSnapshot {
    const deltaSeconds = Math.max(0, frame.deltaMs) / 1000;
    const forwardMeters = this.state.forward * this.metersPerSecond * deltaSeconds;
    const strafeTurn = this.state.strafe * this.turnRadiansPerSecond * deltaSeconds;
    const yawRadians = this.state.yawRadians + strafeTurn;

    this.state = {
      ...this.state,
      z: this.state.z + forwardMeters,
      yawRadians,
      lastRenderedInputTimeMs:
        this.state.lastInputTimeMs === null ? this.state.lastRenderedInputTimeMs : frame.timeMs,
    };

    return this.snapshot();
  }

  snapshot(): AftersignRigSnapshot {
    const inputToRenderMs =
      this.state.lastInputTimeMs === null || this.state.lastRenderedInputTimeMs === null
        ? null
        : this.state.lastRenderedInputTimeMs - this.state.lastInputTimeMs;

    return {
      ...this.state,
      inputToRenderMs,
      withinFrameBudget: inputToRenderMs === null || inputToRenderMs <= this.maxInputToRenderMs,
    };
  }
}

export function checkAftersignInputCameraRigFrameBudget(): void {
  const rig = new AftersignInputCameraRig();

  rig.applyInput({ key: "KeyW", type: "down", timeMs: 1000 });
  const firstFrame = rig.step({ timeMs: 1016, deltaMs: 16 });

  if (firstFrame.inputToRenderMs !== 16) {
    throw new Error(`Expected input-to-render latency to be 16ms, received ${firstFrame.inputToRenderMs}ms`);
  }

  if (!firstFrame.withinFrameBudget) {
    throw new Error("Expected first visible input response to stay inside one 16ms frame");
  }

  if (firstFrame.z <= 0) {
    throw new Error("Expected forward input to move the rig on the first rendered frame");
  }
}

export function runAftersignInputCameraRigChecks(): void {
  checkAftersignInputCameraRigFrameBudget();
}
