# Solo exploration — 2026-10-13

## Scope

- Open issue backlog
- `docs/plan/architecture/README.md`
- Flagship persistence-related test references

## Finding

The durable-authority and durable-return-session playtests each define a
same-named `clearLocalStorage` helper. The production durable-authority spec
explicitly states that it mirrors the helper in the return-session spec.

A follow-up issue proposes extracting this boundary helper so its asynchronous
clear-and-poll behavior cannot drift between persistence recovery playtests.
