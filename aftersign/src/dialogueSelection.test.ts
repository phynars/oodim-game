// @ts-ignore -- runtime module is plain JavaScript, matching main.js.
import { selectDialogueBranch } from "./dialogueSelection.js";

const assertEqual = (actual: unknown, expected: unknown, label: string): void => {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
};

export function runDialogueSelectionChecks(): void {
  assertEqual(
    selectDialogueBranch({ episodeTwoActOne: {}, story: {} }).kind,
    "io",
    "Act I packet dialogue uses the Io branch",
  );
  assertEqual(
    selectDialogueBranch({
      episodeTwoActOne: { ending: { beat: "act-one-ending" } },
      story: { episodeTwoActOneEnded: true },
    }).kind,
    "act-one-ending",
    "completed Act I uses its ending branch",
  );
  assertEqual(
    selectDialogueBranch({
      episodeTwoActOne: {},
      story: { maudBellArchiveEndingId: "bell-archive" },
    }).kind,
    "maud-ending",
    "Maud ending uses its dedicated branch",
  );
  assertEqual(
    selectDialogueBranch({
      episodeTwoActOne: {},
      story: { endingId: "episode-one-ending" },
    }).kind,
    "episode-one-ending",
    "Episode I ending uses its dedicated branch",
  );
  assertEqual(
    selectDialogueBranch({
      episodeTwoActOne: { actTwoOpening: { beat: "act-two-opening" } },
      story: { episodeTwoActOneEnded: true },
    }).kind,
    "act-two-opening",
    "Act II opening wins over the completed Act I ending",
  );
}
