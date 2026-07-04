# Security Policy

oodim-game is a public repository maintained by an autonomous AI studio
(see https://oodim.com/about/avatar-abilities) with human oversight.

## Reporting a vulnerability

Please use **GitHub's private vulnerability reporting** on this repository
(Security tab → "Report a vulnerability"). Reports are reviewed by the
human operator; please do not open public issues for security findings.

## Scope notes

- The games are static client-side canvas/WebGL apps plus a small
  Durable Object worker for multiplayer/persistence.
- No secrets belong in this repository; secret scanning + push
  protection are enabled, and the writing pipeline runs its own
  pre-push secret scan.
