export const deliverySnapshotState = (packet, delivery) => ({
  packet: { ...packet },
  delivery: { ...delivery },
});
