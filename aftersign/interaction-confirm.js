const DEFAULT_CONFIRM_FEEL = Object.freeze({
  hoverExpandPx: 2,
  hoverEaseMs: 120,
  confirmToneHz: 880,
  confirmToneMs: 60,
  confirmGainDb: -6,
  maxPulseStartFrames: 1,
});

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(t) {
  const inverse = 1 - clamp01(t);
  return 1 - inverse * inverse * inverse;
}

function dbToGain(db) {
  return Math.pow(10, db / 20);
}

function createConfirmBlip(audioContext, feel = DEFAULT_CONFIRM_FEEL) {
  if (!audioContext) return null;

  const now = audioContext.currentTime;
  const durationSeconds = feel.confirmToneMs / 1000;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const peakGain = dbToGain(feel.confirmGainDb);

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(feel.confirmToneHz, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);

  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + durationSeconds + 0.01);

  return { oscillator, gain, startedAt: now, durationSeconds };
}

function readPointerFromEvent(event, target) {
  const rect = target.getBoundingClientRect();
  const clientX = event.clientX ?? (event.touches && event.touches[0]?.clientX) ?? 0;
  const clientY = event.clientY ?? (event.touches && event.touches[0]?.clientY) ?? 0;

  return {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: -(((clientY - rect.top) / rect.height) * 2 - 1),
  };
}

function applyPulse(target, eased, feel) {
  if (!target) return;
  const expansion = eased * feel.hoverExpandPx;

  if (target.material?.uniforms?.uConfirmPulse) {
    target.material.uniforms.uConfirmPulse.value = eased;
  }

  if (target.material?.uniforms?.uRimExpansionPx) {
    target.material.uniforms.uRimExpansionPx.value = expansion;
  }

  if (target.scale && target.userData?.confirmBaseScale) {
    const base = target.userData.confirmBaseScale;
    const scalar = 1 + expansion / 100;
    target.scale.set(base.x * scalar, base.y * scalar, base.z * scalar);
  }
}

function captureBaseScale(target) {
  if (!target?.scale || target.userData?.confirmBaseScale) return;
  target.userData.confirmBaseScale = target.scale.clone();
}

export function createInteractionConfirmFeedback({
  canvas,
  camera,
  raycaster,
  targets,
  audioContext,
  requestFrame = requestAnimationFrame,
  now = performance.now.bind(performance),
  feel = DEFAULT_CONFIRM_FEEL,
  onConfirm,
}) {
  if (!canvas) throw new Error('createInteractionConfirmFeedback requires a canvas');
  if (!camera) throw new Error('createInteractionConfirmFeedback requires a camera');
  if (!raycaster) throw new Error('createInteractionConfirmFeedback requires a raycaster');
  if (!targets) throw new Error('createInteractionConfirmFeedback requires selectable targets');

  const selectable = Array.from(targets);
  let hoverTarget = null;
  let pulseTarget = null;
  let pulseStartedAt = 0;
  let pulseFrame = 0;
  let disposed = false;
  const pointer = { x: 0, y: 0 };

  for (const target of selectable) captureBaseScale(target);

  function pick(event) {
    Object.assign(pointer, readPointerFromEvent(event, canvas));
    raycaster.setFromCamera(pointer, camera);
    const [hit] = raycaster.intersectObjects(selectable, true);
    return hit?.object ?? null;
  }

  function tick() {
    if (disposed || !pulseTarget) return;

    pulseFrame += 1;
    const elapsed = now() - pulseStartedAt;
    const progress = clamp01(elapsed / feel.hoverEaseMs);
    applyPulse(pulseTarget, easeOutCubic(1 - progress), feel);

    if (progress < 1) {
      requestFrame(tick);
    } else {
      applyPulse(pulseTarget, 0, feel);
      pulseTarget = null;
    }
  }

  function handlePointerMove(event) {
    hoverTarget = pick(event);
    if (hoverTarget) applyPulse(hoverTarget, 0.35, feel);
  }

  function handlePointerLeave() {
    if (hoverTarget) applyPulse(hoverTarget, 0, feel);
    hoverTarget = null;
  }

  function handlePointerDown(event) {
    const target = pick(event) ?? hoverTarget;
    if (!target) return;

    pulseTarget = target;
    pulseStartedAt = now();
    pulseFrame = 0;
    applyPulse(target, 1, feel);
    createConfirmBlip(audioContext, feel);
    requestFrame(tick);

    onConfirm?.({
      target,
      pointer: { ...pointer },
      pulseStartedAt,
      expectedVisibleByFrame: feel.maxPulseStartFrames,
      toneHz: feel.confirmToneHz,
      toneMs: feel.confirmToneMs,
      gainDb: feel.confirmGainDb,
    });
  }

  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerleave', handlePointerLeave);
  canvas.addEventListener('pointerdown', handlePointerDown);

  return {
    feel,
    get hovered() {
      return hoverTarget;
    },
    get activePulseFrame() {
      return pulseFrame;
    },
    dispose() {
      disposed = true;
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      if (hoverTarget) applyPulse(hoverTarget, 0, feel);
      if (pulseTarget) applyPulse(pulseTarget, 0, feel);
      hoverTarget = null;
      pulseTarget = null;
    },
  };
}

export { DEFAULT_CONFIRM_FEEL, easeOutCubic, dbToGain };
