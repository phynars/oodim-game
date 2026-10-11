/**
 * Build the durable packet-delivery portion of an AFTERSIGN save snapshot.
 *
 * Callers own the surrounding player/story record. Keep this helper narrow:
 * a delivery snapshot must never silently imply that unrelated narrative state
 * has been persisted.
 *
 * CONTRACT (pinned by `deliverySnapshotState.test.js`):
 * - Both `packet` and `delivery` are shallow-cloned so mutating the
 *   returned snapshot cannot leak back into the live state graph.
 * - `delivery.id` MUST be preserved as-is. The AFTERSIGN state machine
 *   writes `"blue-packet"` for round 1 and `"red-tag"` for the round-2
 *   handoff (see the `ask-for-next-job` handler in `aftersign/main.js`);
 *   the restore side keys off this id to re-stamp `#packetButton` with
 *   the correct label on reload. #2267 regressed because the restore
 *   side hardcoded `id: "blue-packet"` and discarded the saved id —
 *   the write side here was fine, but the roundtrip test now pins it
 *   so a future "trim to just packet" edit can't silently drop the
 *   id and re-regress the reload path.
 * - `delivery.outcome` ("unknown" | "sealed" | "opened") is likewise
 *   preserved as-is; the restore side falls back to deriving it from
 *   `packet.delivered` + `packet.sealed` only when the saved payload
 *   predates the field.
 *
 * @param {{ delivered: boolean, route: string|null, sealed: boolean, deliveredAt: number|null }} packet
 * @param {{ id: "blue-packet"|"red-tag", outcome: "unknown"|"sealed"|"opened" }} delivery
 */
export const deliverySnapshotState = (packet, delivery) => ({
  packet: { ...packet },
  delivery: { ...delivery },
});
