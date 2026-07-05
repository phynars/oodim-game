# AFTERSIGN vertical slice backlog

**Owner:** Mara Okonkwo  
**Status:** Proposed delivery order for crew review  
**Source:** `docs/flagship/concept.md` and the flagship mandate in `docs/flagship/BRIEF.md`

## Slice promise

Ship one finished 3D scene: Io's Night Post kiosk on the Silt Stair at night, where the player receives a sealed blue packet, chooses whether to preserve or open it, delivers it to the nearby sign box, returns, and later hears Io remember the exact prior outcome across sessions.

This slice exists to prove the flagship's soul in the smallest possible frame: a player returns and an NPC says something only that NPC could know because of what the player did before.

## Product constraints

- **Story-first:** the first ten minutes must be retellable as a story beat, not a feature tour.
- **Harness-first:** no story beat counts unless the WebGL-headless harness can assert it through `window.__game`.
- **Server-authoritative memory:** Io's returning line must survive reload and cannot be faked by local-only state.
- **One scene, one NPC, one fork:** do not expand into city simulation, combat, multi-NPC chat, or broad episode branching.
- **Phone-first craft:** the kiosk must be readable and playable on a mid-range phone target; desktop is not the lead platform.

## Ordered delivery issues

### 1. Story/state harness contract

**Goal:** Establish the test surface before gameplay code depends on it.

**Player-facing reason:** the studio cannot claim Io remembers the player unless the build can fail when Io remembers incorrectly.

**Scope:**
- Expose `window.__game.version === 1` in the flagship route.
- Surface plain serializable scene, player flag, NPC memory, and save metadata.
- Let tests drive one authored choice and observe the resulting story beat and flags.
- Include red-polarity coverage for at least one broken memory/save mode.

**Acceptance check:** a deterministic WebGL-headless test can choose opened vs sealed packet state and fail if the state contract lies.

**Related open issue:** #391.

### 2. Io kiosk scene skeleton

**Goal:** Create the smallest playable 3D Night Post kiosk that can host the packet choice.

**Player-facing reason:** the player's first action must happen in a place with mood, rules, and readable affordances — not in a menu.

**Scope:**
- Add the flagship route at the intended slug.
- Build Io's kiosk staging area: broken tram kiosk, wet stair/deck surface, lantern/sign focal point, packet pickup spot, nearby sign box.
- Add touch-first movement/inspection sufficient for the scene.
- Expose scene id, beat id, interactable focus, and packet possession through `window.__game`.

**Acceptance check:** the harness can load the scene, wait for quiescent state, inspect Io/sign box availability, and drive the player to the first packet choice.

### 3. Blue packet choice and first return

**Goal:** Author the vertical slice's first meaningful choice: keep the blue packet sealed or open it before delivery.

**Player-facing reason:** the choice must feel like handling an object under trust, not clicking a trivia branch.

**Scope:**
- Implement packet state: unclaimed, carried sealed, carried opened, delivered sealed, delivered opened.
- Make the seal state visible on the packet object.
- Add Io's immediate response after first delivery.
- Persist the authored memory sentence Io is allowed to reference later.

**Acceptance check:** tests can complete both packet paths and assert the correct packet outcome, Io trust posture, authored memory id, and save dirty/revision state.

### 4. Durable save/load memory round-trip

**Goal:** Prove Io's memory survives a reload or second session through server-authoritative persistence.

**Player-facing reason:** the returning-session line only matters if the player believes the game remembered them after they left.

**Scope:**
- Key save state to durable player identity.
- Save completed delivery id, packet outcome, Io trust posture, one authored memory sentence, and last-seen timestamp bucket.
- Add explicit force-save and force-reload hooks for the test harness.
- Reject local-only spoofing as the source of truth.

**Acceptance check:** after reload with the same player identity, Io's NPC memory contains the prior packet outcome and the harness can fail if memory is missing or stale.

### 5. Io returning-session recognition beat

**Goal:** Turn the persisted fact into a felt moment: camera, sign, packet echo, audio sting, and the correct Io line.

**Player-facing reason:** the signature mechanic should land as recognition, not as a database demo.

**Scope:**
- Fire `io_packet_return` only when a durable packet outcome exists.
- Use distinct sealed/opened line ids: `io_return_packet_sealed` and `io_return_packet_opened`.
- Expose beat kind, outcome, line id, timing, input lock, camera delta, and yaw to `window.__game`.
- Keep the beat short enough that the player feels noticed, not trapped.

**Acceptance check:** tests fail if opened state receives the sealed line, sealed state receives the opened line, or the beat fires without durable memory.

**Related open issue:** #401.

### 6. Visual, audio, and mobile finish pass

**Goal:** Remove placeholder feel from the proof scene without broadening scope.

**Player-facing reason:** a remembered line lands harder when the place feels authored: wet paper lantern noir, not prototype cubes.

**Scope:**
- Lighting: warm lantern safety against blue-green wet distance.
- Materials: wet stone, lacquered wood, waxed paper, brass, rope, dark water.
- Post: restrained bloom/vignette/color grade appropriate to phone performance.
- Audio: rain/water bed, sign hum, packet interaction, Io recognition sting.
- Mobile: readable interactables, touch controls, stable 60fps budget target.

**Acceptance check:** a phone-viewport harness pass confirms route load, interactable readability, and no placeholder-cube regression in the authored scene inventory.

## Crew review requests

- **June:** lock Io's sealed/opened returning lines and any immediate delivery response lines before issue 3 starts.
- **Soren:** own issue 1's `window.__game` contract and red-polarity shape; all later work should conform to that surface rather than inventing new hooks.
- **Ivy:** own the tactile choice design for opening or preserving the packet; the interaction should make intent clear before commitment.
- **Diego:** own issue 5's recognition feel numbers and make them assertable, not just descriptive.

## Cut line

If budget, CI, or implementation drag threatens the slice, cut in this order:

1. extra kiosk props;
2. optional inspection barks;
3. non-Io ambient sign reactions;
4. alternate route traversal;
5. any second NPC.

Do **not** cut the harness contract, durable memory, or Io's correct returning line. Those are the slice.
