export type RouteRiskChoiceId = 'lit-stair' | 'dark-cut';

export type RouteRiskChoice = {
  id: RouteRiskChoiceId;
  label: string;
  consequenceFact: string;
  tapPriority: number;
};

export type RouteRiskMemory = {
  completedRuns: number;
  lastRouteRisk?: RouteRiskChoiceId;
  darkCutDebt?: boolean;
};

export type RouteRiskOffer = {
  choices: RouteRiskChoice[];
  recommendedId: RouteRiskChoiceId;
};

const LIT_STAIR: RouteRiskChoice = {
  id: 'lit-stair',
  label: 'Take the long lit stair',
  consequenceFact: 'chose the long lit stair',
  tapPriority: 1,
};

const DARK_CUT: RouteRiskChoice = {
  id: 'dark-cut',
  label: 'Cut through the short dark passage',
  consequenceFact: 'chose the short dark cut',
  tapPriority: 2,
};

export function buildRouteRiskOffer(memory: RouteRiskMemory): RouteRiskOffer {
  const choices = memory.darkCutDebt ? [LIT_STAIR] : [LIT_STAIR, DARK_CUT];

  return {
    choices,
    recommendedId: memory.completedRuns === 0 || memory.darkCutDebt ? 'lit-stair' : 'dark-cut',
  };
}

export function recordRouteRiskChoice(
  memory: RouteRiskMemory,
  choiceId: RouteRiskChoiceId,
): RouteRiskMemory {
  const offer = buildRouteRiskOffer(memory);

  if (!offer.choices.some((choice) => choice.id === choiceId)) {
    throw new Error(`Route risk choice is not currently available: ${choiceId}`);
  }

  return {
    ...memory,
    completedRuns: memory.completedRuns + 1,
    lastRouteRisk: choiceId,
    darkCutDebt: choiceId === 'dark-cut' ? true : memory.darkCutDebt,
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function checkFirstRunOffersTwoTappableRouteChoices(): void {
  const offer = buildRouteRiskOffer({ completedRuns: 0 });

  assert(offer.choices.length === 2, 'first run should expose two route choices');
  assert(
    offer.choices.some((choice) => choice.id === 'lit-stair'),
    'first run should offer the long lit stair',
  );
  assert(
    offer.choices.some((choice) => choice.id === 'dark-cut'),
    'first run should offer the short dark cut',
  );
  assert(
    offer.choices.every((choice) => choice.label.length > 0 && choice.tapPriority > 0),
    'every route choice needs a visible label and stable tap priority',
  );
}

export function checkDarkCutMemoryRemovesRiskAction(): void {
  const afterDarkCut = recordRouteRiskChoice({ completedRuns: 0 }, 'dark-cut');
  const nextOffer = buildRouteRiskOffer(afterDarkCut);

  assert(
    nextOffer.choices.length === 1 && nextOffer.choices[0]?.id === 'lit-stair',
    'taking the dark cut should mechanically change the next available route action',
  );
}

export function checkUnavailableRouteChoiceIsRejected(): void {
  assert(
    buildRouteRiskOffer({ completedRuns: 1, darkCutDebt: true }).choices.every(
      (choice) => choice.id !== 'dark-cut',
    ),
    'dark cut should not be offered while the dark-cut debt is active',
  );

  let rejected = false;

  try {
    recordRouteRiskChoice({ completedRuns: 1, darkCutDebt: true }, 'dark-cut');
  } catch {
    rejected = true;
  }

  assert(rejected, 'unavailable route choices should fail before they mutate memory');
}

export function runRouteRiskFeelChecks(): void {
  checkFirstRunOffersTwoTappableRouteChoices();
  checkDarkCutMemoryRemovesRiskAction();
  checkUnavailableRouteChoiceIsRejected();
}
