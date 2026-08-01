export type OrraMemoryReference =
  | "orra.met"
  | "orra.player_took_signal"
  | "orra.player_left_signal"
  | "orra.player_waited"
  | "orra.player_rushed"
  | "orra.player_named_debt"
  | "orra.player_refused_debt";

export interface OrraMemoryLine {
  id: string;
  text: string;
  references: OrraMemoryReference[];
}

export const ORRA_MEMORY_LINES: readonly OrraMemoryLine[] = [
  {
    id: "orra-return-signal-taken",
    text: "You came back with my signal still warm in your pocket. Good. That means you know when a debt is alive.",
    references: ["orra.met", "orra.player_took_signal"],
  },
  {
    id: "orra-return-signal-left",
    text: "You left my signal behind and came back anyway. Either brave, lost, or expensive. I can work with two of those.",
    references: ["orra.met", "orra.player_left_signal"],
  },
  {
    id: "orra-return-waited",
    text: "You waited last time. Most couriers mistake motion for nerve. You did not.",
    references: ["orra.met", "orra.player_waited"],
  },
  {
    id: "orra-return-rushed",
    text: "You ran before the room finished speaking. The room remembers. So do I.",
    references: ["orra.met", "orra.player_rushed"],
  },
  {
    id: "orra-debt-named",
    text: "You named what you owed. Careful habit. Names make debts easier to find in the dark.",
    references: ["orra.met", "orra.player_named_debt"],
  },
  {
    id: "orra-debt-refused",
    text: "You said you owed nothing. I respect a clean lie. I also keep ledgers.",
    references: ["orra.met", "orra.player_refused_debt"],
  },
];

export function selectOrraMemoryLines(
  remembered: ReadonlySet<OrraMemoryReference>,
): OrraMemoryLine[] {
  return ORRA_MEMORY_LINES.filter((line) =>
    line.references.every((reference) => remembered.has(reference)),
  );
}
