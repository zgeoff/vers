// Collects the skills a transcript loaded since its last compaction, which summarizes earlier loads
// away. A skill loads through a Skill tool call that succeeded, or a slash command the user types.
export function collectLoadedSkills(transcript: string): readonly string[] {
  const entries = transcript.split('\n').map((line) => parseEntry(line));
  const lastBoundary = entries.findLastIndex((entry) => isCompactBoundary(entry));
  const current = entries.slice(lastBoundary + 1);
  const succeeded = collectSucceededToolUseIDs(current);
  const skills = current.flatMap((entry) => collectEntrySkills(entry, succeeded));

  return [...new Set(skills)];
}

function parseEntry(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function isCompactBoundary(entry: unknown): boolean {
  return isRecord(entry) && entry['type'] === 'system' && entry['subtype'] === 'compact_boundary';
}

function collectSucceededToolUseIDs(entries: readonly unknown[]): readonly string[] {
  return entries
    .flatMap((entry) => collectContentBlocks(entry, 'user'))
    .filter((block) => block['type'] === 'tool_result' && block['is_error'] !== true)
    .flatMap((block) => (typeof block['tool_use_id'] === 'string' ? [block['tool_use_id']] : []));
}

function collectContentBlocks(
  entry: unknown,
  type: string,
): readonly Readonly<Record<string, unknown>>[] {
  if (!isRecord(entry) || entry['type'] !== type || !isRecord(entry['message'])) {
    return [];
  }

  const content = entry['message']['content'];

  return Array.isArray(content) ? content.filter((block: unknown) => isRecord(block)) : [];
}

function collectEntrySkills(entry: unknown, succeeded: readonly string[]): readonly string[] {
  const command = findSlashCommand(entry);

  if (command !== undefined) {
    return [command];
  }

  return collectContentBlocks(entry, 'assistant').flatMap((block) =>
    collectSkillCall(block, succeeded),
  );
}

function findSlashCommand(entry: unknown): string | undefined {
  if (!isRecord(entry) || entry['type'] !== 'user' || !isRecord(entry['message'])) {
    return undefined;
  }

  const content = entry['message']['content'];

  return typeof content === 'string'
    ? SLASH_COMMAND_PATTERN.exec(content)?.groups?.['skill']
    : undefined;
}

// A slash command opens the user message with its tags, in either order.
const SLASH_COMMAND_PATTERN =
  /^\s*(?:<command-message>[^<]*<\/command-message>\s*)?<command-name>\/(?<skill>[^<\s]+)<\/command-name>/u;

function collectSkillCall(
  block: Readonly<Record<string, unknown>>,
  succeeded: readonly string[],
): readonly string[] {
  const input = block['input'];
  const id = block['id'];

  if (block['type'] !== 'tool_use' || block['name'] !== 'Skill' || !isRecord(input)) {
    return [];
  }

  const skill = input['skill'];

  return typeof skill === 'string' && typeof id === 'string' && succeeded.includes(id)
    ? [skill]
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
