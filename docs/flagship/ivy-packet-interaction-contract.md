# AFTERSIGN — sealed packet interaction feel contract

**Owner:** Ivy Tran  
**Status:** Draft for implementation  
**Scope:** Vertical-slice packet choice at Io's Night Post kiosk

## Why this exists

The first meaningful action in AFTERSIGN is whether the player keeps Io's sealed blue packet intact or opens it before delivery. That choice cannot feel like a dialogue menu or inventory toggle. It is the first trust fork, so the input must feel deliberate, tactile, and auditable.

The player should understand this without a modal tutorial:

- carrying the packet away is the default, low-friction path;
- opening it is possible, but requires intent;
- once the seal breaks, the game commits story state immediately;
- Io's later recognition line must match the persisted packet outcome.

## Interaction rule

### Preserve seal: default fast path

- Packet begins in `sealed` state.
- A tap / interact press picks up or inspects the packet without opening it.
- Releasing before the open threshold leaves the packet sealed.
- Walking away with the sealed packet must not require confirming “keep sealed.”

### Open seal: committed hold

Opening the packet is a hold interaction, not a tap.

Recommended timing:

- **0 ms:** player starts hold on packet seal hotspot.
- **150 ms:** wax visibly strains; this is feedback, not commitment.
- **350 ms:** subtle paper tension sound / visual vibration begins.
- **650 ms:** minimum commit threshold.
- **850 ms:** upper bound for full animation; slower than this feels sticky.
- **Commit tick:** `packetSealState` flips from `sealed` to `opened` on the same simulation tick as the seal-break animation / sound event.

Cancel behavior:

- Releasing before 650 ms cancels cleanly.
- Cancelled holds leave `packetSealState === "sealed"`.
- The packet should settle back within 150 ms after cancellation.

## Feel numbers

| Element | Contract |
| --- | --- |
| Open input | continuous hold, 650–850 ms commit window |
| First feedback | visible by 150 ms |
| Cancel recovery | settled within 150 ms |
| Story-state flip | same tick as seal-break commit |
| Post-commit input lock | no full movement/look lock longer than 12 frames |
| Touch target | large enough to hit intentionally on phone; seal hotspot should not steal generic movement drags |

## State names for harnesses

These names are implementation recommendations, not final API law. The harness needs equivalent observable state.

```ts
type PacketSealState = 'sealed' | 'opening' | 'opened';
type PacketDeliveryOutcome = 'undelivered' | 'delivered_sealed' | 'delivered_opened';

window.__game.story = {
  currentBeat: 'io_packet_choice',
  packetSealState: 'sealed',
  packetDeliveryOutcome: 'undelivered',
  ioLastLineId: null,
};
```

## Harness acceptance checks

Add these before or alongside implementation:

1. **Initial state:** when the slice starts, `packetSealState` is `sealed` and `packetDeliveryOutcome` is `undelivered`.
2. **Short tap safety:** a tap / hold shorter than 650 ms never changes `packetSealState` to `opened`.
3. **Hold commit:** a continuous hold that reaches the commit threshold changes `packetSealState` to `opened` on the same tick as the open-commit event.
4. **Delivery records seal state:** delivering while sealed writes `delivered_sealed`; delivering after opening writes `delivered_opened`.
5. **Return line matches persistence:** on a later session, Io's line id matches the persisted delivery outcome: sealed outcome produces the sealed-return line, opened outcome produces the opened-return line.
6. **Recognition control budget:** Io's recognition beat may guide camera / framing, but must not hard-lock movement or look input for more than 12 frames.

## Player-facing frame

The player is not choosing between two menu labels. They are deciding whether to break a seal with their own hands.

Preserving trust should feel like restraint: easy, quiet, and fast. Breaking trust should feel like pressure: held, visible, audible, and irreversible once the wax gives.

## Non-goals

- No inventory screen for the first packet fork.
- No abstract morality meter.
- No long cinematic handoff before the player acts.
- No local-only state proof for Io's returning line.

Refs #401
