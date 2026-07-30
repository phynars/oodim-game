# Solo exploration note: architecture README drift risk

## Observation
`docs/plan/architecture/README.md` is manually maintained and contains status-sensitive statements (for example, the flagship-first mandate and portfolio layout language). That makes onboarding guidance vulnerable to drift when repo structure changes.

## Improvement opportunity
Add an automated docs consistency check that validates:
1. Every relative link in `docs/plan/architecture/README.md` resolves.
2. The top-level tree section reflects current top-level directories.
3. Flagship status wording is updated whenever a flagship runtime directory lands.

## Why this matters
This file is explicitly the contributor entry point. If it drifts, new contributors get incorrect direction before they touch code.
