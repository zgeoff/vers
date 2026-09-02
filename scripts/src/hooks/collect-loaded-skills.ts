/**
 * Collects the skills a session transcript shows as loaded and still in context: every Skill tool
 * call after the last compaction boundary, or after the start when the transcript holds none.
 * A skill loaded before a compaction is summarized away with the rest of the context, so it does
 * not count.
 */
export function collectLoadedSkills(transcript: string): ReadonlySet<string> {
  const lines = transcript.split('\n');
  const lastBoundary = lines.findLastIndex((line) => line.includes(COMPACT_BOUNDARY_MARKER));

  const loaded = new Set<string>();

  for (const line of lines.slice(lastBoundary + 1)) {
    for (const match of line.matchAll(SKILL_CALL_PATTERN)) {
      const skill = match.groups?.['skill'];

      if (skill !== undefined) {
        loaded.add(skill);
      }
    }
  }

  return loaded;
}

const COMPACT_BOUNDARY_MARKER = '"subtype":"compact_boundary"';

// A Skill tool_use serializes its input with `skill` as the first key, with or without `args` after it.
const SKILL_CALL_PATTERN = /"name":"Skill","input":\{"skill":"(?<skill>[^"]+)"/g;
