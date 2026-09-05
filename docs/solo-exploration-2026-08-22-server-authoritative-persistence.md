# Solo exploration — 2026-08-22

## Finding

The flagship brief requires player memory persistence to be server-authoritative through Workers, Durable Objects, or D1. The served-page durable-return playtest instead documents a synchronous `localStorage` save before reload. This proves a same-browser reload, not durable identity-backed memory across devices or cleared browser storage.

## Follow-up

Tracked as a backend-persistence issue so the flagship's signature mechanic matches its stated authority boundary.
