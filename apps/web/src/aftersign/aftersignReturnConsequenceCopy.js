/**
 * Io's spoken payoff after a completed route.
 *
 * The caller owns which consequence is actually available; this function
 * names that consequence without reducing it to an affinity score.
 */
export function chooseAftersignReturnConsequenceCopy({ outcome, nextAction }) {
  const action = nextAction ?? "come back for another run";

  if (outcome === "opened") {
    return {
      line: "You opened what was sealed. Fine. The next door stays lit—use it before it learns better.",
      action,
    };
  }

  if (outcome === "withheld") {
    return {
      line: "You kept it off the books. So did I. There is a route that only works while nobody is looking.",
      action,
    };
  }

  return {
    line: "Seal intact. I can spend that fact. Take the stair above the lamps; it is open to you now.",
    action,
  };
}
