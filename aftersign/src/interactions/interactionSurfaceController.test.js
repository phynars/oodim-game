import { createInteractionSurfaceController } from "./interactionSurfaceController.js";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const expectThrows = (fn, matcher, message) => {
  let threw = null;
  try {
    fn();
  } catch (error) {
    threw = error;
  }
  assert(threw !== null, `${message}: expected a throw, got none`);
  assert(threw instanceof TypeError, `${message}: expected TypeError, got ${threw.constructor.name}`);
  assert(matcher.test(threw.message), `${message}: message "${threw.message}" did not match ${matcher}`);
};

export const runInteractionSurfaceControllerChecks = () => {
  // Validation: both wires are required, and the label flavors the
  // thrown message so composition mistakes point at the right surface.
  expectThrows(
    () => createInteractionSurfaceController({ handleInput: () => {}, label: "jobOffer" }),
    /jobOffer.*getState/,
    "missing getState throws labelled TypeError",
  );
  expectThrows(
    () => createInteractionSurfaceController({ getState: () => ({}), label: "packetOffer" }),
    /packetOffer.*handleInput/,
    "missing handleInput throws labelled TypeError",
  );
  expectThrows(
    () => createInteractionSurfaceController(),
    /interactionSurface.*getState/,
    "no-arg call throws with the default label",
  );

  // Forwarding: getState and handleInput both pass through to the
  // injected wires exactly once, with the input argument intact.
  const stateSentinel = { r: 1 };
  let getStateCalls = 0;
  let lastInput;
  let handleInputCalls = 0;

  const controller = createInteractionSurfaceController({
    label: "routeChoice",
    getState: () => {
      getStateCalls += 1;
      return stateSentinel;
    },
    handleInput: (input) => {
      handleInputCalls += 1;
      lastInput = input;
      return "ack";
    },
  });

  assert(controller.label === "routeChoice", "label is exposed on the frozen controller");
  assert(controller.getState() === stateSentinel, "getState returns the authoritative sentinel");
  assert(getStateCalls === 1, "getState wire is called exactly once");

  const inputSentinel = { choice: "fast" };
  const result = controller.handleInput(inputSentinel);
  assert(result === "ack", "handleInput forwards the return value from the commit path");
  assert(handleInputCalls === 1, "handleInput wire is called exactly once");
  assert(lastInput === inputSentinel, "handleInput forwards the input argument unchanged");

  // The frozen result rejects hidden state — composition cannot bolt on
  // ad-hoc fields later and expect them to stick.
  const frozen = createInteractionSurfaceController({
    getState: () => stateSentinel,
    handleInput: () => undefined,
  });
  let mutationThrew = false;
  try {
    // @ts-ignore — probing the freeze contract
    frozen.extra = 1;
    if (frozen.extra === 1) {
      // strict-mode module: assignment should have thrown; if we got here
      // the write silently failed, which also satisfies the freeze
      // contract.
      mutationThrew = false;
    }
  } catch {
    mutationThrew = true;
  }
  assert(
    mutationThrew || frozen.extra === undefined,
    "controller is frozen — adding a field either throws or silently drops",
  );
};
