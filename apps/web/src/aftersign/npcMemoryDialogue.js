import {
  NPC_MEMORY_FLAG_LISTENED_TO_ROUTE,
  NPC_MEMORY_FLAG_PACKET_OPENED,
  NPC_MEMORY_FLAG_PACKET_SEALED,
  NPC_MEMORY_FLAG_RETURN_TONE_BLUNT,
  NPC_MEMORY_FLAG_RETURN_TONE_EVASIVE,
  NPC_MEMORY_FLAG_RETURN_TONE_KIND,
} from './npcMemoryFlagSchema.js';

export const IO_RETURN_TONE_KIND = 'kind';
export const IO_RETURN_TONE_EVASIVE = 'evasive';
export const IO_RETURN_TONE_BLUNT = 'blunt';

const IO_FIRST_RETURN_LINES = {
  [NPC_MEMORY_FLAG_PACKET_SEALED]: 'You came back. So did the blue seal, unbroken. That gives me two facts to trust.',
  [NPC_MEMORY_FLAG_PACKET_OPENED]: 'You came back. The seal did not. I can use one of those facts.',
};

const IO_ROUTE_MEMORY_LINES = {
  [NPC_MEMORY_FLAG_LISTENED_TO_ROUTE]: 'You listened before you ran. Rare habit. Keep it.',
};

const IO_RETURN_TONE_REPLIES = {
  [IO_RETURN_TONE_KIND]: {
    flag: NPC_MEMORY_FLAG_RETURN_TONE_KIND,
    label: 'I came back because you waited.',
    line: 'Careful. Say that twice and I will start charging you for loyalty.',
  },
  [IO_RETURN_TONE_EVASIVE]: {
    flag: NPC_MEMORY_FLAG_RETURN_TONE_EVASIVE,
    label: 'I needed the work.',
    line: 'Work is the clean answer. It is rarely the whole one.',
  },
  [IO_RETURN_TONE_BLUNT]: {
    flag: NPC_MEMORY_FLAG_RETURN_TONE_BLUNT,
    label: 'I do not know where else to go.',
    line: 'Then stand here until the city gives you a better lie.',
  },
};

export function getIoReturnRecognitionLine(memoryFlags = []) {
  const flags = new Set(memoryFlags);

  if (flags.has(NPC_MEMORY_FLAG_PACKET_OPENED)) {
    return IO_FIRST_RETURN_LINES[NPC_MEMORY_FLAG_PACKET_OPENED];
  }

  if (flags.has(NPC_MEMORY_FLAG_PACKET_SEALED)) {
    return IO_FIRST_RETURN_LINES[NPC_MEMORY_FLAG_PACKET_SEALED];
  }

  if (flags.has(NPC_MEMORY_FLAG_LISTENED_TO_ROUTE)) {
    return IO_ROUTE_MEMORY_LINES[NPC_MEMORY_FLAG_LISTENED_TO_ROUTE];
  }

  return 'You came back. That is rarer than clean weather.';
}

export function getIoReturnToneOptions() {
  return [
    {
      id: IO_RETURN_TONE_KIND,
      flag: IO_RETURN_TONE_REPLIES[IO_RETURN_TONE_KIND].flag,
      label: IO_RETURN_TONE_REPLIES[IO_RETURN_TONE_KIND].label,
    },
    {
      id: IO_RETURN_TONE_EVASIVE,
      flag: IO_RETURN_TONE_REPLIES[IO_RETURN_TONE_EVASIVE].flag,
      label: IO_RETURN_TONE_REPLIES[IO_RETURN_TONE_EVASIVE].label,
    },
    {
      id: IO_RETURN_TONE_BLUNT,
      flag: IO_RETURN_TONE_REPLIES[IO_RETURN_TONE_BLUNT].flag,
      label: IO_RETURN_TONE_REPLIES[IO_RETURN_TONE_BLUNT].label,
    },
  ];
}

export function getIoReturnToneReply(tone) {
  return IO_RETURN_TONE_REPLIES[tone]?.line ?? IO_RETURN_TONE_REPLIES[IO_RETURN_TONE_EVASIVE].line;
}

export function getIoNextJobLine(tone) {
  if (tone === IO_RETURN_TONE_KIND) {
    return 'Take the upper stair. Saint Orra has a name caught in her teeth, and she only bites couriers she likes.';
  }

  if (tone === IO_RETURN_TONE_BLUNT) {
    return 'Good. Honest fear walks faster. Take the upper stair; Orra has a name that will not stay buried.';
  }

  return 'Fine. Keep your reasons folded. Take the upper stair; Orra has a name waiting to cut someone.';
}
