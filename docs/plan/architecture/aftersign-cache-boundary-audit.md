# AFTERSIGN cache-boundary audit

The product architecture identifies `aftersign/src/story-state.js` as a client-side shadow that reads and writes `aftersign.kioskSlice.v1`, while also stating that the served page no longer boots from that local value and durable persistence is authoritative.

This boundary warrants a focused implementation audit: establish whether the client cache has a current consumer and, if it does, specify its recovery and invalidation contract. If it has none, remove the dead persistence surface rather than retaining a second, versioned save representation.

Tracked in the project issue created from this exploration.
