import { afterEach, describe, expect, it, vi } from "vitest";
import {
  attachIoReturnActionFeedback,
  IO_RETURN_ACTION_AUDIO,
  IO_RETURN_ACTION_FEEL,
  playIoReturnActionAudio,
} from "./ioReturnActionFeedback.js";

afterEach(() => {
  vi.useRealTimers();
  // Reset the shared AudioContext slot between tests so each test
  // gets a fresh injected fake.
  if (typeof globalThis !== "undefined") {
    delete (/** @type {any} */ (globalThis)).__aftersignAudioContext;
  }
});

describe("attachIoReturnActionFeedback", () => {
  it("presses to 0.96, releases over 180ms, then couples haptic and audio at 28ms", () => {
    vi.useFakeTimers();
    const button = document.createElement("button");
    const haptic = vi.fn();
    const audio = vi.fn();
    const detach = attachIoReturnActionFeedback(button, { haptic, audio });

    button.dispatchEvent(new Event("pointerdown"));
    expect(button.dataset.ioReturnActionFeedback).toBe("pressed");
    expect(button.style.transform).toBe("scale(0.96)");
    expect(button.style.getPropertyValue("--io-return-action-press-scale")).toBe("0.96");

    button.dispatchEvent(new Event("pointerup"));
    expect(button.dataset.ioReturnActionFeedback).toBe("released");
    expect(button.style.transform).toBe("scale(1)");
    expect(button.style.transition).toContain(`${IO_RETURN_ACTION_FEEL.releaseDurationMs}ms`);
    expect(haptic).not.toHaveBeenCalled();
    expect(audio).not.toHaveBeenCalled();

    vi.advanceTimersByTime(IO_RETURN_ACTION_FEEL.couplingDelayMs - 1);
    expect(haptic).not.toHaveBeenCalled();
    expect(audio).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(haptic).toHaveBeenCalledTimes(1);
    expect(audio).toHaveBeenCalledTimes(1);

    detach();
  });
});

// PR #1885 iter-6 (addressing Soren's REQUEST_CHANGES): the "audio"
// callback in prior iterations only wrote `lastCue` — no oscillator,
// no gain ramp, no scheduling on an AudioContext. This block proves
// `playIoReturnActionAudio()` schedules a REAL tone via WebAudio's
// oscillator + gain graph, using the frozen `IO_RETURN_ACTION_AUDIO`
// data table (165Hz / triangle / 120ms / peak gain 0.08 / 10ms
// attack). The sibling bar this PR must meet is
// `jobOfferConfirmAudio.js` (196Hz / triangle / 120ms) — an actual
// tone, scheduled on the shared context.

function createFakeAudioContext(overrides = {}) {
  const setValueAtTime = vi.fn();
  const linearRampToValueAtTime = vi.fn();
  const gainNode = {
    gain: { setValueAtTime, linearRampToValueAtTime },
    connect: vi.fn(),
  };
  const frequency = { setValueAtTime: vi.fn() };
  const oscillator = {
    type: null,
    frequency,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const ctx = {
    state: overrides.state ?? "running",
    currentTime: overrides.currentTime ?? 100,
    destination: { __marker: "dest" },
    createOscillator: vi.fn(() => oscillator),
    createGain: vi.fn(() => gainNode),
    resume: vi.fn(() => Promise.resolve()),
  };
  return { ctx, oscillator, gainNode, frequency, setValueAtTime, linearRampToValueAtTime };
}

describe("playIoReturnActionAudio (real tone scheduling)", () => {
  it("schedules a 165Hz triangle-wave burst with the frozen envelope on the injected AudioContext", () => {
    const fake = createFakeAudioContext();
    const scheduled = playIoReturnActionAudio({ contextFactory: () => fake.ctx });
    expect(scheduled).toBe(true);

    // Oscillator was created and configured with the frozen params.
    expect(fake.ctx.createOscillator).toHaveBeenCalledTimes(1);
    expect(fake.oscillator.type).toBe(IO_RETURN_ACTION_AUDIO.waveform);
    expect(fake.frequency.setValueAtTime).toHaveBeenCalledWith(
      IO_RETURN_ACTION_AUDIO.frequencyHz,
      fake.ctx.currentTime,
    );

    // Gain ramp: 0 at start → peakGain at attack → 0.0001 at stop.
    const startAt = fake.ctx.currentTime;
    const attackAt = startAt + IO_RETURN_ACTION_AUDIO.attackMs / 1000;
    const stopAt = startAt + IO_RETURN_ACTION_AUDIO.durationMs / 1000;
    expect(fake.setValueAtTime).toHaveBeenCalledWith(0, startAt);
    expect(fake.linearRampToValueAtTime).toHaveBeenNthCalledWith(
      1,
      IO_RETURN_ACTION_AUDIO.peakGain,
      attackAt,
    );
    expect(fake.linearRampToValueAtTime).toHaveBeenNthCalledWith(2, 0.0001, stopAt);

    // Oscillator was connected through the gain node to the destination
    // and actually START/STOPped — the schedule is executed, not just
    // configured.
    expect(fake.oscillator.connect).toHaveBeenCalledWith(fake.gainNode);
    expect(fake.gainNode.connect).toHaveBeenCalledWith(fake.ctx.destination);
    expect(fake.oscillator.start).toHaveBeenCalledWith(startAt);
    expect(fake.oscillator.stop).toHaveBeenCalledWith(stopAt + 0.02);
  });

  it("resumes a suspended AudioContext before scheduling (autoplay-policy path)", () => {
    const fake = createFakeAudioContext({ state: "suspended" });
    const scheduled = playIoReturnActionAudio({ contextFactory: () => fake.ctx });
    expect(scheduled).toBe(true);
    expect(fake.ctx.resume).toHaveBeenCalledTimes(1);
    // Scheduling still happens — the tail plays as soon as the
    // context unlocks.
    expect(fake.oscillator.start).toHaveBeenCalledTimes(1);
  });

  it("returns false without throwing when no AudioContext is available", () => {
    const scheduled = playIoReturnActionAudio({ contextFactory: () => null });
    expect(scheduled).toBe(false);
  });

  it("reuses the cached shared AudioContext across calls", () => {
    const factory = vi.fn(() => createFakeAudioContext().ctx);
    const first = playIoReturnActionAudio({ contextFactory: factory });
    const second = playIoReturnActionAudio({ contextFactory: factory });
    expect(first).toBe(true);
    expect(second).toBe(true);
    // The factory is invoked only ONCE — the cached context on the
    // globalThis slot is reused on the second call. Cheaper than
    // constructing a new context per tap; also matches the sibling
    // failure-sting / job-offer-confirm discipline of one shared ctx.
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("IO_RETURN_ACTION_AUDIO exports the frozen tone shape the sibling job-offer-confirm bar established", () => {
    // Same shape as `JOB_OFFER_CONFIRM_AUDIO` in
    // `aftersign/src/jobOfferConfirmAudio.js`: cue token,
    // frequencyHz, attackMs, durationMs, peakGain, waveform.
    expect(IO_RETURN_ACTION_AUDIO.cue).toBe("io-return-action");
    expect(typeof IO_RETURN_ACTION_AUDIO.frequencyHz).toBe("number");
    expect(IO_RETURN_ACTION_AUDIO.frequencyHz).toBeGreaterThan(0);
    expect(IO_RETURN_ACTION_AUDIO.waveform).toBe("triangle");
    expect(typeof IO_RETURN_ACTION_AUDIO.durationMs).toBe("number");
    expect(IO_RETURN_ACTION_AUDIO.durationMs).toBeGreaterThan(0);
    expect(typeof IO_RETURN_ACTION_AUDIO.peakGain).toBe("number");
    expect(IO_RETURN_ACTION_AUDIO.peakGain).toBeGreaterThan(0);
    expect(Object.isFrozen(IO_RETURN_ACTION_AUDIO)).toBe(true);
  });
});
