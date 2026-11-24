# Spec — #3031 Accepted job shortcut choices

**Story:** #3031 · **Epic:** #2579 · **Research:** [docs/research/3031-job-acceptance-shortcut-choices.md](../research/3031-job-acceptance-shortcut-choices.md)

## Problem

A player who accepts an Episode 2 job needs a visible acknowledgement of that acceptance before choosing a route action. Acceptance must not imply that the player selected a shortcut.

## Behaviour

1. The player taps the visible Accept control for an Episode 2 job on the served page.
2. The dialogue panel shows an `Accepted` acknowledgement for that job.
3. The route-choice tray shows each available action as a separate visible control.
4. The player taps one route action; only that selected action receives the selected state and any later memory describes that action, not job acceptance.

## Acceptance criteria

- AC-1: WHEN the player taps the visible Accept control for an Episode 2 job, THE served AFTERSIGN page SHALL show an Accepted acknowledgement associated with that job before the player selects a route action.
- AC-2: WHEN the Accepted acknowledgement is visible, THE served AFTERSIGN page SHALL present each available shortcut action as a separate tappable control.
- AC-3: WHEN the player taps a visible shortcut action after accepting the job, THE served AFTERSIGN page SHALL mark only that tapped action as selected and SHALL NOT represent job acceptance as a shortcut selection.
- AC-4: WHEN the player reloads or restores after accepting a job without tapping a shortcut action, THE served AFTERSIGN page SHALL NOT present a shortcut action as selected.

## Out of scope

- Changing Episode 2 job eligibility, job copy, route outcomes, or the available-action rules.
- Treating job acceptance as a persisted route choice.
- Changes to frozen games or non-AFTERSIGN runtime behaviour.

## References

- Research: [docs/research/3031-job-acceptance-shortcut-choices.md](../research/3031-job-acceptance-shortcut-choices.md)
- Architecture: [docs/plan/architecture/README.md#client-components](../plan/architecture/README.md#client-components)

## Constitution check

- C1: pass — the story concerns the active AFTERSIGN flagship.
- C2: pass — the build test will tap visible served-page controls at phone viewport; `window.__game` will be assertions only.
- C3: pass — the design maps every acceptance criterion to a named test written red before the build change.
- C4: pass — the build outcome is visible on the served AFTERSIGN page.
- C5: pass — job acceptance and a shortcut action remain distinct, preventing false memory.
- C6: pass — this spec follows the research → spec → design sequence and is indexed.
- C7: pass — the result is checkable through a served-page test and repository state.
- C8: pass — scope is limited to acknowledgement and shortcut-choice presentation.
