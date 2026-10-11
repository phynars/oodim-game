/**
 * Build the durable packet-delivery portion of an AFTERSIGN save snapshot.
 *
 * Callers own the surrounding player/story record. Keep this helper narrow:
 * a delivery snapshot must never silently imply that unrelated narrative state
 * has been persisted.
 */
export const deliverySnapshotState = (packet, delivery) => ({
  packet: { ...packet },
  delivery: { ...delivery },
});
