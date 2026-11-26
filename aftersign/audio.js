// AFTERSIGN audio controller. ES module — imported by main.js so Vite
// bundles it into dist-aftersign.
import { createAftersignMusicLayer } from "./music-layer.js";

export const createAftersignAudioController = ({
  state, markStateDirty, publishState, confirmFeedback, jobOfferConfirmAudio,
  onMusicStateChange = () => {},
}) => {
  let audioContext;
  let impactBurstChirpGain;
  let rainFilter;
  let kioskHum;
  let musicLayer;

  const stamp = (cue) => {
    state._runtime.audio.lastCue = cue;
    state._runtime.audio.lastCueAt = performance.now();
    markStateDirty();
    publishState();
  };
  const makeRainBuffer = (context) => {
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * 0.38;
    return buffer;
  };
  const startAmbientAudio = () => {
    if (!audioContext || state._runtime.audio.ambientStarted) return;
    const gain = audioContext.createGain();
    gain.gain.value = 0.045;
    gain.connect(audioContext.destination);
    const rain = audioContext.createBufferSource();
    rain.buffer = makeRainBuffer(audioContext);
    rain.loop = true;
    rainFilter = audioContext.createBiquadFilter();
    rainFilter.type = "bandpass";
    rainFilter.frequency.value = 1350;
    rainFilter.Q.value = 0.72;
    rain.connect(rainFilter).connect(gain);
    rain.start();
    kioskHum = audioContext.createOscillator();
    kioskHum.type = "sine";
    kioskHum.frequency.value = 91;
    const humGain = audioContext.createGain();
    humGain.gain.value = 0.018;
    kioskHum.connect(humGain).connect(gain);
    kioskHum.start();
    state._runtime.audio.ambientStarted = true;
    state._runtime.audio.ambientState = "playing";
    musicLayer = createAftersignMusicLayer({ audioContext, destination: audioContext.destination });
    musicLayer.start();
    state._runtime.audio.musicStarted = musicLayer.started;
    state._runtime.audio.musicMuted = musicLayer.muted;
    state._runtime.audio.musicState = musicLayer.started ? (musicLayer.muted ? "muted" : "playing") : "idle";
    markStateDirty();
    // Any unlocking gesture (kiosk sound, job offer, confirm) reaches here,
    // so the music control's visibility is synced from the music layer itself.
    onMusicStateChange({ started: musicLayer.started, muted: musicLayer.muted });
  };
  const enableAudio = async () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) { stamp("unsupported"); return false; }
    audioContext ||= new AudioContext();
    if (audioContext.state === "suspended") await audioContext.resume();
    state._runtime.audio.unlocked = audioContext.state === "running";
    if (state._runtime.audio.unlocked && !state._runtime.audio.ambientStarted) {
      startAmbientAudio();
      stamp("ambient-rainline");
    } else if (state._runtime.audio.unlocked && musicLayer && !musicLayer.started) {
      // Music was stopped by Start fresh: the next unlocking gesture
      // restarts it exactly as the first one did at boot.
      musicLayer.start();
      syncMusicRuntime();
      stamp("music-restarted");
    }
    markStateDirty();
    publishState();
    return state._runtime.audio.unlocked;
  };
  const syncMusicRuntime = () => {
    const started = Boolean(musicLayer?.started);
    const muted = Boolean(musicLayer?.muted);
    state._runtime.audio.musicStarted = started;
    state._runtime.audio.musicMuted = muted;
    state._runtime.audio.musicState = started ? (muted ? "muted" : "playing") : "idle";
    markStateDirty();
    onMusicStateChange({ started, muted });
  };
  // Start fresh (#3093 F1): stop the music voice and clear its runtime flags
  // so the cold-boot "Enable music" label matches what the button does next.
  const resetMusic = () => {
    musicLayer?.stop();
    syncMusicRuntime();
    publishState();
  };
  const toggleMusic = async () => {
    if (!(await enableAudio()) || !musicLayer) return false;
    musicLayer.setMuted(!musicLayer.muted);
    state._runtime.audio.musicMuted = musicLayer.muted;
    state._runtime.audio.musicState = musicLayer.muted ? "muted" : "playing";
    markStateDirty();
    stamp(musicLayer.muted ? "music-muted" : "music-unmuted");
    // Resync the control so its label/aria flip ("Mute music" <-> "Unmute music").
    onMusicStateChange({ started: musicLayer.started, muted: musicLayer.muted });
    return musicLayer.muted;
  };
  const playTone = (frequencyHz, durationMs, peakGain, waveform = "triangle", attackMs = 18) => {
    if (!audioContext) return;
    const now = audioContext.currentTime;
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peakGain, now + attackMs / 1000);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
    gain.connect(audioContext.destination);
    const tone = audioContext.createOscillator();
    tone.type = waveform;
    tone.frequency.setValueAtTime(frequencyHz, now);
    tone.connect(gain);
    tone.start(now);
    tone.stop(now + durationMs / 1000);
  };
  const playKioskConfirm = async () => {
    stamp("packet-confirmed");
    if (await enableAudio()) playTone(confirmFeedback.audioCue.frequencyHz, confirmFeedback.audioCue.durationMs, 0.14);
    stamp("packet-confirmed");
  };
  const playJobOfferConfirm = async () => {
    stamp(jobOfferConfirmAudio.cue);
    if (await enableAudio()) playTone(jobOfferConfirmAudio.frequencyHz, jobOfferConfirmAudio.durationMs, jobOfferConfirmAudio.peakGain, jobOfferConfirmAudio.waveform, jobOfferConfirmAudio.attackMs);
    stamp(jobOfferConfirmAudio.cue);
  };
  const triggerRecognitionImpactChirp = async ({ frequencyHz, durationMs }) => {
    stamp("recognition-impact-chirp");
    if (!(await enableAudio()) || !audioContext) return;
    const now = audioContext.currentTime;
    impactBurstChirpGain ??= audioContext.createGain();
    impactBurstChirpGain.connect(audioContext.destination);
    impactBurstChirpGain.gain.cancelScheduledValues(now);
    impactBurstChirpGain.gain.setValueAtTime(0.0001, now);
    impactBurstChirpGain.gain.exponentialRampToValueAtTime(0.07, now + 0.01);
    impactBurstChirpGain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
    const chirp = audioContext.createOscillator();
    chirp.type = "sine";
    chirp.frequency.setValueAtTime(frequencyHz, now);
    chirp.connect(impactBurstChirpGain);
    chirp.start(now);
    chirp.stop(now + durationMs / 1000);
  };
  const playFailureStingAudio = async () => {
    stamp("packet-cancelled");
    if (await enableAudio()) playTone(144, 120, 0.09, "triangle", 12);
    stamp("packet-cancelled");
  };
  const updateAmbient = (t) => {
    if (rainFilter) rainFilter.frequency.value = 1280 + Math.sin(t * 0.7) * 180;
    if (kioskHum) kioskHum.frequency.value = 89 + Math.sin(t * 0.45) * 3;
  };
  return { enableAudio, toggleMusic, resetMusic, playKioskConfirm, playJobOfferConfirm, triggerRecognitionImpactChirp, playFailureStingAudio, updateAmbient };
};
