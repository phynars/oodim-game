// Procedural SFX (issue #89). Synthesize every sound effect in code via the
// WebAudio API — no .wav / .mp3 assets ship. The "doom" tone (chunky weapon,
// crunchy hit, bright pickup) is bought with detuned oscillators + noise +
// short envelopes, not authored audio.
//
// AUTOPLAY POLICY: browsers gate AudioContext on a user gesture. The engine
// constructs an Audio instance at boot (lazy — no context until needed) and
// calls `unlock()` on the first input gesture (keydown / pointerdown). Until
// then, every play* call is a silent no-op — but the context is still created
// on first unlock so the e2e harness can assert the wiring is live.
//
// TEST CONTRACT: `window.__doomAudio` publishes the audio handle so the e2e
// harness can prove (a) the AudioContext is created on first unlock and
// (b) a sound node is triggered on fire / hit / pickup events. The harness
// asserts the wiring (counters increment, ctx exists), never the audible
// output — headless Chromium can't read pixels OR speakers.

/** Standardized WebAudio context type. `webkitAudioContext` is the Safari
 *  legacy alias; we keep the union so types stay portable. */
type AnyAudioContext = AudioContext;

interface AudioContextCtor {
  new (): AnyAudioContext;
}

/** Pull the most-available AudioContext constructor. Returns null in
 *  environments without WebAudio (very old browsers, some test harnesses);
 *  the rest of the module treats that as "audio disabled — every play is a
 *  no-op". */
function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Public contract published on `window.__doomAudio` for the e2e harness.
 *  The harness asserts that a context exists after first unlock AND that
 *  fire/hit/pickup events bump the matching counter — proving each play*
 *  helper actually constructed + triggered a sound node, without trying
 *  to listen to headless audio. */
export interface DoomAudioHandle {
  /** True iff `unlock()` has been called AND an AudioContext was created. */
  readonly unlocked: boolean;
  /** True iff an `AudioContext` instance exists. Same as `unlocked` in
   *  practice — exposed separately so the assertion reads cleanly. */
  readonly contextPresent: boolean;
  /** Monotonic counter: incremented every time `playWeapon()` triggers
   *  a sound node. Stays at 0 while audio is locked. */
  readonly weaponShots: number;
  /** Monotonic counter for `playEnemyHit()`. */
  readonly enemyHits: number;
  /** Monotonic counter for `playEnemyDeath()`. */
  readonly enemyDeaths: number;
  /** Monotonic counter for `playPickup()`. */
  readonly pickups: number;
}

/** The audio engine. Single instance per game; lazy WebAudio context. */
export class DoomAudio {
  private ctx: AnyAudioContext | null = null;
  private master: GainNode | null = null;
  private _unlocked = false;

  // Counters published on the test handle. Incremented every time a play*
  // helper actually triggers a node — so a "0 ammo, no fire" trigger does
  // NOT bump weaponShots (the engine guards that before calling).
  private _weaponShots = 0;
  private _enemyHits = 0;
  private _enemyDeaths = 0;
  private _pickups = 0;

  /** Lazy-construct the AudioContext + master gain. Called by `unlock()`
   *  on first gesture; a no-op if the context already exists OR if the
   *  environment doesn't expose WebAudio. */
  private ensureContext(): AnyAudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = getAudioContextCtor();
    if (!Ctor) return null;
    try {
      const ctx = new Ctor();
      const master = ctx.createGain();
      // Conservative master so the page never blares. Tunable later.
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      return ctx;
    } catch {
      // Some browsers throw under autoplay restrictions even on a gesture;
      // we fall back to silence + leave the handle locked.
      return null;
    }
  }

  /** Called by the engine on the first user gesture (keydown / pointerdown).
   *  Creates the AudioContext if needed, resumes it if suspended (Safari
   *  starts contexts suspended even after gesture), and flips `unlocked=true`
   *  so subsequent play* calls produce sound. Idempotent — safe to call on
   *  every gesture; only the first one does real work. */
  unlock(): void {
    if (this._unlocked) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    // Some browsers return a context in the 'suspended' state until resume()
    // is called explicitly. The promise is fire-and-forget — we only care
    // that the call kicks the audio thread.
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {
        // ignore — playback will retry resume on next play*
      });
    }
    this._unlocked = true;
  }

  /** Weapon shot — a short, punchy click. A square sub-oscillator gives the
   *  body, a quick noise burst gives the bark, both decay in ~120ms. */
  playWeapon(): void {
    const ctx = this.maybeContext();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;

    // Body: square wave that pitch-drops fast (a "thock").
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.1);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.0001, now);
    oscGain.gain.exponentialRampToValueAtTime(0.6, now + 0.005);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(oscGain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.15);

    // Bark: short noise burst, high-passed so it reads as crack, not rumble.
    const noise = this.makeNoiseSource(0.08);
    if (noise) {
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 1200;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.5, now);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      noise.connect(hp).connect(ng).connect(this.master);
      noise.start(now);
      noise.stop(now + 0.1);
    }

    this._weaponShots += 1;
  }

  /** Enemy hit — a low thud with a touch of growl. Triangle wave so it
   *  reads as "meat", not as another weapon. */
  playEnemyHit(): void {
    const ctx = this.maybeContext();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.5, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.18);
    this._enemyHits += 1;
  }

  /** Enemy death — longer, lower-pitched groan made from a saw that pitch-
   *  bends down over ~400ms. Distinguishable from a hit by its tail. */
  playEnemyDeath(): void {
    const ctx = this.maybeContext();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.45, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.5);
    this._enemyDeaths += 1;
  }

  /** Pickup — a bright two-note chirp (perfect fifth) on a sine, ~120ms.
   *  Cheerful so it reads as "good thing" against the dim corridors. */
  playPickup(): void {
    const ctx = this.maybeContext();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;

    const blip = (freq: number, start: number, dur: number): void => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.4, start + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      o.connect(g).connect(this.master!);
      o.start(start);
      o.stop(start + dur + 0.02);
    };
    // A → E (perfect fifth up), classic arcade pickup signature.
    blip(880, now, 0.08);
    blip(1320, now + 0.07, 0.1);

    this._pickups += 1;
  }

  /** Return the live AudioContext if we're unlocked AND it constructed.
   *  Otherwise null — every play* helper short-circuits to a silent no-op. */
  private maybeContext(): AnyAudioContext | null {
    if (!this._unlocked) return null;
    const ctx = this.ctx;
    if (!ctx) return null;
    // If a tab-switch suspended us, kick it again. Fire-and-forget; if
    // resume fails the next play* re-tries.
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => undefined);
    }
    return ctx;
  }

  /** Build a short white-noise AudioBufferSourceNode for the weapon bark.
   *  Returns null if the context doesn't exist. Buffer is sized for `dur`
   *  seconds at the context's sample rate. */
  private makeNoiseSource(dur: number): AudioBufferSourceNode | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    return src;
  }

  /** Build the public read-only handle for the e2e harness. Getters so
   *  the harness always reads live counter values, not a stale snapshot. */
  handle(): DoomAudioHandle {
    const self = this;
    return {
      get unlocked() {
        return self._unlocked;
      },
      get contextPresent() {
        return self.ctx !== null;
      },
      get weaponShots() {
        return self._weaponShots;
      },
      get enemyHits() {
        return self._enemyHits;
      },
      get enemyDeaths() {
        return self._enemyDeaths;
      },
      get pickups() {
        return self._pickups;
      },
    };
  }
}
