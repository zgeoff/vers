export function collectLoadedSkills(transcript: string): ReadonlySet<string> {
  const lines = transcript.split('\n');
  const lastBoundary = lines.findLastIndex((line) => line.includes(COMPACT_BOUNDARY_MARKER));

  const loaded = new Set<string>();

  for (const line of lines.slice(lastBoundary + 1)) {
    for (const skill of parseLineSkills(line)) {
      loaded.add(skill);
    }
  }

  return loaded;
}

const COMPACT_BOUNDARY_MARKER = '"subtype":"compact_boundary"';

// Serializers order object keys freely across models, so each line parses as JSON instead of pattern-matching one key order.
function parseLineSkills(line: string): ReadonlyArray<string> {
  let entry: unknown;

  try {
    entry = JSON.parse(line);
  } catch {
    return [];
  }

  if (typeof entry !== 'object' || entry === null) {
    return [];
  }

  if (
    typeof entry !== 'object' ||
    entry === null ||
    !('type' in entry) ||
    entry.type !== 'assistant' ||
    !('message' in entry)
  ) {
    return [];
  }

  const message = entry.message;

  if (typeof message !== 'object' || message === null || !('content' in message)) {
    return [];
  }

  const content = message.content;

  if (!Array.isArray(content)) {
    return [];
  }

  const skills: Array<string> = [];

  for (const block of content) {
    const skill = readSkillName(block);

    if (skill !== undefined) {
      skills.push(skill);
    }
  }

  return skills;
}

function readSkillName(block: unknown): string | undefined {
  if (
    typeof block !== 'object' ||
    block === null ||
    !('type' in block) ||
    !('name' in block) ||
    !('input' in block)
  ) {
    return undefined;
  }

  if (block.type !== 'tool_use' || block.name !== 'Skill') {
    return undefined;
  }

  const input = block.input;

  if (typeof input !== 'object' || input === null || !('skill' in input)) {
    return undefined;
  }

  return typeof input.skill === 'string' ? input.skill : undefined;
}
