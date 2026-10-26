// AFTERSIGN synthesized music layer.
// This module owns the musical voice separately from interaction cues so a
// player-visible control can mute music without suppressing confirmation audio.
export const createAftersignMusicLayer = ({ audioContext, destination }) => {
  const gain = audioContext.createGain();
  gain.gain.value = 0.024;
  gain.connect(destination);

  let started = false;
  let muted = false;
  let timer = null;
  let nextAt = 0;
  const notes = [220, 261.63, 329.63, 392, 329.63, 261.63];

  const schedule = () => {
    if (!started) return;
    const now = audioContext.currentTime;
    nextAt = Math.max(nextAt, now + 0.03);
    while (nextAt < now + 1.2) {
      const oscillator = audioContext.createOscillator();
      const envelope = audioContext.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = notes[Math.floor((nextAt * 2) % notes.length)];
      envelope.gain.setValueAtTime(0.0001, nextAt);
      envelope.gain.exponentialRampToValueAtTime(0.12, nextAt + 0.03);
      envelope.gain.exponentialRampToValueAtTime(0.0001, nextAt + 0.42);
      oscillator.connect(envelope).connect(gain);
      oscillator.start(nextAt);
      oscillator.stop(nextAt + 0.45);
      nextAt += 0.5;
    }
    timer = setTimeout(schedule, 500);
  };

  return {
    start() {
      if (started) return;
      started = true;
      schedule();
    },
    setMuted(value) {
      muted = Boolean(value);
      gain.gain.setTargetAtTime(muted ? 0 : 0.024, audioContext.currentTime, 0.02);
    },
    get muted() { return muted; },
    get started() { return started; },
  };
};
