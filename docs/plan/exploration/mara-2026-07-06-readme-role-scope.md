# Solo exploration note — README role scope drift

## Observation
The repo-level `README.md` still describes the **Developer** role as owning "game loop, rendering, input, ghost AI" in the studio table. In the same README, the portfolio now spans Pac-Man, Galaga, Doom, and agar (including multiplayer server-authoritative work), so this role text is now Pac-Man-specific and drifts from the actual multi-game scope.

## Why this matters
New contributors use this README as entry context. Pac-Man-specific role language can mis-set expectations about ownership and responsibilities across the rest of the portfolio.

## Smallest fix
Update the studio role table to use game-agnostic ownership wording for Developer/Designer/Story where needed, while preserving concise onboarding tone.
