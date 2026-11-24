# Spec — #2994 Titled intro, readable jobs, and Io dialogue

**Story:** #2994 · **Epic:** #2893 · **Research:** [research](../research/2994-titled-intro-readable-jobs-and-io.md)

## Problem

At a phone viewport, a player may lack an opening orientation, lose job controls in a card, receive combined Io dialogue, or meet a red-tag button that produces no visible result.

## Behaviour

The served page starts with AFTERSIGN and an orientation sentence before job controls. Existing second-job controls remain reachable through page scrolling. A visible Ask for next job tap produces separately rendered Io remarks. Red tag — Saint Orra is a button only when its tap visibly changes state.

## Acceptance criteria

- AC-1: WHEN a new player loads the served AFTERSIGN page at 390×844, THE page SHALL render "AFTERSIGN" and one orientation sentence before any job control.
- AC-2: WHEN the served second-job list exceeds the 390×844 viewport, THE AFTERSIGN page SHALL make every existing job control reachable by page-level scrolling without a nested-card swipe.
- AC-3: WHEN the player taps the visible "Ask for next job" control, THE AFTERSIGN page SHALL render each Io remark in a separate visible line or paragraph element.
- AC-4: WHEN "Red tag — Saint Orra" does not advance visible state on tap, THE AFTERSIGN page SHALL render it as non-button text.

## Out of scope

- Existing job rules, labels, packet and route decisions, endings, and save fields.
- New job branches or changes to Io's authored facts.

## References

- Research: [Titled intro, readable jobs, and Io dialogue](../research/2994-titled-intro-readable-jobs-and-io.md)
- Architecture: [Client components](../plan/architecture/README.md#client-components)

## Constitution check

- C1: pass — active flagship AFTERSIGN only.
- C2: pass — later tests use visible controls and page scroll at 390×844; state is assertions only.
- C3: pass — the design names one later test per criterion.
- C4: pass — later build work changes the served page; this stage is docs only.
- C5: pass — no history facts or authored memory claims change.
- C6: pass — research, spec, design, and index are present.
- C7: pass — viewport, scrolling, controls, and DOM structure are repository-testable.
- C8: pass — scope is limited to opening legibility and truthful affordances.
