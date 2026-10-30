// Self-test for scripts/docs-index-check.mjs (pure parts). Runs in CI before
// the gate itself: `node --test scripts/docs-index-check.test.mjs`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { acceptanceCriteria, checkDesign, checkIndex, checkResearch, checkSpec, checkedArticles, constitutionIds, mermaidKinds, storyNumber } from "./docs-index-check.mjs";

test("Constitution check accepts plain, bold and table forms (review of #2581)", () => {
  assert.deepEqual([...checkedArticles("- C1: pass\r\n- **C2**: pass\r\n| C3 | pass |\r\n| **C4** | n/a — docs |\r\nC5 is fine")], ["C1", "C2", "C3", "C4"]);
});

test("mermaidKinds skips %% comments and init directives", () => {
  assert.deepEqual(mermaidKinds("```mermaid\n%%{init: {'theme':'dark'}}%%\n%% note\nsequenceDiagram\n```"), ["sequenceDiagram"]);
});

const SPEC = `# Spec — #2600 ending card honesty

## Acceptance criteria

- AC-1: WHEN the player reaches the ending without tapping "Take the second packet", THE ending card SHALL NOT say the red tag was accepted.
- AC-2: IF the episode is complete, THEN THE panel SHALL hide the "Choose before you leave" prompt.

## References

- Research: [r](../research/2600-ending-card.md)

## Constitution check

- C1: pass
- C2: pass
- C3: pass
`;

test("storyNumber + constitutionIds + mermaidKinds", () => {
  assert.equal(storyNumber("docs/specs/2600-ending-card.md"), 2600);
  assert.equal(storyNumber("docs/specs/ending-card.md"), null);
  assert.deepEqual(constitutionIds("| **C1** | a |\n| **C2** | b |\n| **C1** | dup |"), ["C1", "C2"]);
  assert.deepEqual(mermaidKinds("```mermaid\nflowchart LR\n```\n```mermaid\nsequenceDiagram\n```"), ["flowchart", "sequenceDiagram"]);
});

test("spec: EARS ACs, references and every constitution article", () => {
  assert.deepEqual(acceptanceCriteria(SPEC).map((a) => a.id), ["AC-1", "AC-2"]);
  assert.deepEqual(checkSpec("docs/specs/2600-ending-card.md", SPEC, ["C1", "C2", "C3"]), []);
  const prose = SPEC.replace("AC-1: WHEN", "AC-1: Make sure that when");
  assert.match(checkSpec("docs/specs/2600-x.md", prose, ["C1", "C2", "C3"])[0], /AC-1 is not in an EARS shape/);
  assert.match(checkSpec("docs/specs/2600-x.md", SPEC, ["C1", "C2", "C3", "C7"])[0], /missing C7/);
  const noRefs = SPEC.replace("(../research/2600-ending-card.md)", "(elsewhere.md)");
  assert.match(checkSpec("docs/specs/2600-x.md", noRefs, ["C1", "C2", "C3"])[0], /must link docs\/research\/2600-/);
  const internal = noRefs.replace("- Research: [r](elsewhere.md)", "References: internal-only");
  assert.deepEqual(checkSpec("docs/specs/2600-x.md", internal, ["C1", "C2", "C3"]), []);
});

test("research: two external sources", () => {
  assert.deepEqual(checkResearch("r.md", "## Sources\n| R1 | <https://a.example/x> |\n| R2 | <https://b.example/y> |\n## Next"), []);
  assert.match(checkResearch("r.md", "## Sources\n| R1 | <https://a.example/x> |\n")[0], /at least 2/);
});

test("design: both diagrams, the architecture link and a test-map row per AC", () => {
  const good = "[arch](../plan/architecture/README.md#memory)\n```mermaid\nflowchart LR\nA-->B\n```\n```mermaid\nsequenceDiagram\nP->>UI: tap\n```\n## Test map\n| AC | f |\n|---|---|\n| AC-1 | a.spec.ts |\n| AC-2 | b.test.ts |\n";
  assert.deepEqual(checkDesign("docs/design/2600-x.md", good, SPEC), []);
  assert.match(checkDesign("docs/design/2600-x.md", good.replace("| AC-2 | b.test.ts |\n", ""), SPEC)[0], /no row for AC-2/);
  assert.match(checkDesign("docs/design/2600-x.md", good.replace("sequenceDiagram", "flowchart"), SPEC)[0], /sequenceDiagram/);
  assert.match(checkDesign("docs/design/2600-x.md", good, null).at(-1), /no spec/);
});

test("index: every doc listed, every local link resolves", () => {
  const exists = (p) => ["docs/specs/2600-x.md", "docs/CONSTITUTION.md"].includes(p.replace(/\\/g, "/"));
  assert.deepEqual(checkIndex("[s](specs/2600-x.md) [c](CONSTITUTION.md) [w](https://example.com)", "docs", ["docs/specs/2600-x.md"], exists), []);
  const errs = checkIndex("[gone](specs/9-y.md)", "docs", ["docs/specs/2600-x.md"], exists);
  assert.deepEqual(errs, ["docs/INDEX.md: link specs/9-y.md points nowhere", "docs/INDEX.md: docs/specs/2600-x.md is not listed"]);
});
